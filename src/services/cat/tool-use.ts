/**
 * Cat Tool Use — Platform Search Enrichment
 *
 * Before the main streaming response, checks if the user's message looks like
 * a discovery query and optionally calls the provider tool API to search the
 * platform. Enriches the messages array with tool call results so the final
 * response has real platform data to draw on.
 *
 * This file is the orchestrator (maybeEnrichWithSearchResults). The pieces live in
 * sibling modules and are re-exported here so the public surface is unchanged:
 *   - tool-use-types.ts      — message/event/proposal types
 *   - tool-use-detection.ts  — intent detection + tool definitions
 *   - tool-executor.ts       — executeToolCall (runs one tool)
 *
 * The optional `onToolCall` callback fires for each lifecycle event of every tool
 * the Cat triggers (running → completed/no_results/failed). The chat route pipes
 * these into the SSE stream so the user sees what the Cat is actually doing.
 */

import { actionToolDefinitions } from './action-schemas';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import {
  messageMightNeedTools,
  hasCreateIntent,
  hasWebsiteAnalysisIntent,
  PLATFORM_TOOL_DEFINITION,
} from './tool-use-detection';
import { executeToolCall } from './tool-executor';
import { extractHttpUrls, isUrlOnlyMessage } from './website-analysis';
import type {
  ToolAugmentedMessage,
  ToolCallAssistantMessage,
  ToolResultMessage,
  OnToolCall,
  OnPrefillProposal,
  RawToolCall,
} from './tool-use-types';

// Public surface — unchanged for consumers (chat-orchestrator imports from here).
export { messageMightNeedTools } from './tool-use-detection';
export type {
  ChatMessage,
  ToolAugmentedMessage,
  ToolCallResultRef,
  ToolCallEvent,
  OnToolCall,
  PrefillProposal,
  OnPrefillProposal,
} from './tool-use-types';

/** Max model⇄tool round-trips per user turn. Bounds cost + latency; most
 *  requests need 1, some 2 (search → refine, or search → prefill). */
const MAX_TOOL_STEPS = 3;

/**
 * Hard ceiling for the ENTIRE tool phase (routing round-trips + tool
 * executions). The tool phase runs inside the SSE stream BEFORE any content
 * reaches the user, so an unbounded await here means the chat hangs on typing
 * dots. When the deadline hits, we degrade to the un-enriched messages (plus
 * an honest note when the user clearly wanted a site analyzed) and let the
 * main model answer.
 */
const TOOL_PHASE_TIMEOUT_MS = 25_000;

/**
 * When the tool phase fails or times out on a message that wanted a website
 * read, the main model must NOT guess the site's content — it gets this note
 * so it can tell the user honestly what happened.
 */
const WEBSITE_FETCH_FAILED_NOTE =
  "NOTE: The user's message contains a website URL, but the site could not be fetched " +
  '(the tool step failed or timed out). Tell the user plainly that you could not reach ' +
  'the site right now and ask them to check the URL or try again — do NOT guess, ' +
  "describe, or invent the site's content.";

/** What the tool phase falls back to when it fails or times out. */
function degradedMessages(
  messages: ToolAugmentedMessage[],
  userMessage: string
): ToolAugmentedMessage[] {
  if (hasWebsiteAnalysisIntent(userMessage)) {
    return [...messages, { role: 'system', content: WEBSITE_FETCH_FAILED_NOTE }];
  }
  return messages;
}

/**
 * Returns the messages array, possibly enriched with platform search results.
 * Non-fatal AND bounded: on any failure — or when the whole tool phase exceeds
 * its hard timeout — resolves with the original messages (plus an honest
 * degrade note where appropriate). It never throws and never hangs, so the
 * chat stream around it always completes.
 *
 * If `onToolCall` is provided, every tool the Cat invokes emits at least one
 * lifecycle event ('running' → one of completed/no_results/failed). The route
 * uses these to surface tool activity to the user via SSE. After the timeout
 * fires, late callbacks are suppressed (the stream has moved on).
 */
export async function maybeEnrichWithSearchResults(
  supabase: AnySupabaseClient,
  userId: string,
  messages: ToolAugmentedMessage[],
  userMessage: string,
  provider: string,
  groqKey: string | null,
  modelToUse: string,
  onToolCall?: OnToolCall,
  onPrefillProposal?: OnPrefillProposal,
  opts?: { timeoutMs?: number; actorId?: string | null }
): Promise<ToolAugmentedMessage[]> {
  // Tool detection uses OpenAI-compatible function-calling. Enabled on the two
  // providers that actually serve OrangeCat: Groq (BYOK, paid TPM) and
  // OpenRouter (the platform path + many BYOK models — gpt-oss-120b returns
  // proper tool_calls). Without this, platform-tier discovery/matchmaking was
  // dead (Groq 429s, so the platform runs on OpenRouter). Other providers fall
  // back to no tools until they get an adapter.
  let toolEndpoint: string;
  let toolKey: string | undefined;
  if (provider === 'groq') {
    toolEndpoint = `${PROVIDER_BASE_URLS.groq}/chat/completions`;
    toolKey = groqKey ?? process.env.GROQ_API_KEY;
  } else if (provider === 'openrouter') {
    toolEndpoint = `${PROVIDER_BASE_URLS.openrouter}/chat/completions`;
    toolKey = process.env.OPENROUTER_API_KEY;
  } else {
    return messages;
  }

  if (!messageMightNeedTools(userMessage)) {
    return messages;
  }

  if (!toolKey) {
    return messages;
  }

  // Robustness guarantee: the whole tool phase races a hard deadline. A
  // hanging provider or tool can therefore never stall the chat stream — the
  // worst case is an un-enriched answer. After the deadline, callback events
  // from the orphaned loop are suppressed so nothing is enqueued into a
  // stream that has moved on.
  const timeoutMs = opts?.timeoutMs ?? TOOL_PHASE_TIMEOUT_MS;
  let expired = false;
  const guardedOnToolCall: OnToolCall | undefined = onToolCall
    ? event => {
        if (!expired) {
          onToolCall(event);
        }
      }
    : undefined;
  const guardedOnPrefillProposal: OnPrefillProposal | undefined = onPrefillProposal
    ? proposal => {
        if (!expired) {
          onPrefillProposal(proposal);
        }
      }
    : undefined;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raced = await Promise.race([
      runToolLoop({
        supabase,
        userId,
        messages,
        userMessage,
        toolEndpoint,
        toolKey,
        modelToUse,
        timeoutMs,
        onToolCall: guardedOnToolCall,
        onPrefillProposal: guardedOnPrefillProposal,
        actorId: opts?.actorId ?? null,
      }),
      new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      }),
    ]);
    if (raced === 'timeout') {
      return degradedMessages(messages, userMessage);
    }
    return raced;
  } catch {
    return degradedMessages(messages, userMessage);
  } finally {
    expired = true;
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/** The entityType a prefill_entity_form call targets ('' when unparseable). */
function prefillType(toolCall: RawToolCall): string {
  try {
    const args = JSON.parse(toolCall.function?.arguments ?? '{}') as { entityType?: string };
    return args.entityType ?? '';
  } catch {
    return '';
  }
}

/**
 * The bounded agentic loop: the model can call a tool, see the result, and
 * decide its next move — up to MAX_TOOL_STEPS round-trips. May throw or run
 * long; maybeEnrichWithSearchResults wraps it with the catch + deadline.
 */
async function runToolLoop(args: {
  supabase: AnySupabaseClient;
  userId: string;
  messages: ToolAugmentedMessage[];
  userMessage: string;
  toolEndpoint: string;
  toolKey: string;
  modelToUse: string;
  timeoutMs: number;
  onToolCall?: OnToolCall;
  onPrefillProposal?: OnPrefillProposal;
  /** Present ⇒ the model may CALL actions, not just read tools (ADR-0006 D2). */
  actorId?: string | null;
}): Promise<ToolAugmentedMessage[]> {
  const {
    supabase,
    userId,
    messages,
    userMessage,
    toolEndpoint,
    toolKey,
    modelToUse,
    timeoutMs,
    onToolCall,
    onPrefillProposal,
    actorId,
  } = args;

  // ADR-0006 D1/D2 — actions are offered as tools alongside the read tools, so
  // the model can DO something and see the outcome before it writes.
  //
  // Deliberately unfiltered by permission: the executor is the authority and
  // already denies + audits, and a denial comes back as a sentence the model
  // relays honestly ("not permitted — tell the user what to grant"). Filtering
  // here would need a second copy of the permission-resolution rules, and two
  // copies of that is worse than a rare wasted proposal.
  //
  // Only when we have an actor: without one nothing can be created, and
  // offering tools that must fail teaches the model to propose them.
  const availableTools = actorId
    ? [...PLATFORM_TOOL_DEFINITION, ...actionToolDefinitions()]
    : PLATFORM_TOOL_DEFINITION;

  // Tool detection runs on a SLIM, routing-only prompt — NOT the full
  // conversational system prompt. The big "be a warm helpful agent" prompt
  // biases the model to chat (finish_reason=stop) instead of emitting a
  // tool_call, so platform search never fired. Here the only job is: decide
  // which tool (if any) the request needs and with what args.
  const detectionMessages = [
    {
      role: 'system' as const,
      content:
        'You gather what an OrangeCat chat request needs by calling platform tools. Call ONE tool at a time; after you see its result you may call another tool to refine or follow up, or stop when you have enough.\n' +
        '- prefill_entity_form: when the user describes something THEY want to create / sell / offer / launch / fundraise (e.g. "I make mugs and want to sell them", "I want to start a project"). This is about THEIR own new thing. Pick entityType by what the thing IS: selling time/skill/labor (even at a fixed price, "haircuts, 40 CHF") = service; a tangible/digital item = product; fundraising a defined outcome = project; open-ended no-strings support = cause; the user NEEDS money and will repay = loan; a dated gathering = event; renting out something owned = asset; a community organizing itself = circle. Call it ONCE per distinct entity — never twice for the same thing.\n' +
        '- search_platform: ONLY when the user wants to FIND, discover, or connect with things that already exist on the platform and belong to OTHERS (e.g. "find a designer", "who else is building X"). You may search again with a refined query if the first results are weak.\n' +
        '- suggest_offers: when the user asks what THEY could offer/sell/create, how they could make money or participate, or wants ideas grounded in who they are (e.g. "what can I offer?", "help me make money", "any ideas for me?"). It reads their stored profile/documents/memories — pass no message text, just an optional focus.\n' +
        '- forget_memories: when the user says something you know about them is WRONG or asks you to forget/remove/correct it (e.g. "I don\'t speak French", "that\'s not true, remove it", "forget the weekend thing"). Pass each wrong fact as a short phrase. Stored memories change ONLY through this tool — if the user asks for a correction and you skip it, nothing is saved.\n' +
        '- analyze_website: when the user pastes a website URL or bare domain and wants it read, analyzed, or used to set them up (e.g. "here\'s my site: https://… — set me up on OrangeCat", or a message that is nothing but a domain). Pass the EXACT URL from their message. After you see the extracted site text, follow its instructions: chain prefill_entity_form calls (at most 3, all in one message) for entities the site directly evidences — never for anything the site does not say.\n' +
        '- explore_topic: when the user expresses an INTEREST or curiosity rather than naming a specific thing to find ("I\'m interested in longevity", "anyone working on Bitcoin education?", "introduce me to people doing X"). Pass the topic in their own words. Use this, NOT search_platform, for interests — it also finds the people behind the work so an introduction is possible.\n' +
        '- query_my_data: when the user asks about their OWN stuff or numbers — earnings/sales ("how much did I earn?"), their listings ("what am I selling?"), bookings, wallet balances/goals, unread notifications, open tasks, or a general catch-up ("how am I doing?", "catch me up"). Read-only. Pick the closest topic (listings, earnings, bookings, wallets, notifications, tasks) or "overview" for a broad question.\n' +
        '- check_cat_health: ONLY when the user asks why the Cat/AI is failing, slow, or not answering, or asks about a system notification mentioning provider failures, eval/harness errors, or Cat health (e.g. "why is my Cat not answering?", "what does this eval error notification mean?"). Takes no arguments.\n' +
        'You may also call any ACTION tool (create_project, update_entity, …) when the user clearly asks you to DO that thing — not to explore it. An action WRITES, so call it only on a clear instruction; its result comes back to you before you reply, so never claim something is done until you have seen that result.\n' +
        'NEVER call search_platform for a create/sell/offer intent — describing your own thing to list is prefill_entity_form, not a search. If neither clearly applies, call no tool. Only decide and call tools — do not write a chat reply.',
    },
    { role: 'user' as const, content: userMessage },
  ];

  // `loopMessages` carries the routing context + accumulated tool dialogue so
  // each step is informed by prior results; `enriched` is what the main chat
  // call sees.
  const loopMessages: ToolAugmentedMessage[] = [...detectionMessages];
  const enriched: ToolAugmentedMessage[] = [...messages];

  // Entity types already drafted in an EARLIER step. Weak routing models keep
  // re-calling prefill_entity_form for the same thing after seeing its result,
  // which showed the user two identical draft cards. Same-step multiples stay
  // allowed (the website flow legitimately chains several in one message);
  // a repeat of an already-drafted type in a LATER step is always the dup bug.
  const prefilledTypes = new Set<string>();

  // A message that is ONLY a URL/domain has exactly one plausible meaning —
  // "read this site and set me up" — so run analyze_website programmatically
  // instead of hoping the (weak) routing model decides to. The model then
  // sees the fetched site text on its first round-trip and chains
  // prefill_entity_form calls from it.
  if (isUrlOnlyMessage(userMessage)) {
    const url = extractHttpUrls(userMessage)[0];
    if (url) {
      const syntheticCall: RawToolCall = {
        id: `call_analyze_${Date.now().toString(36)}`,
        type: 'function',
        function: { name: 'analyze_website', arguments: JSON.stringify({ url }) },
      };
      const assistantMsg: ToolCallAssistantMessage = {
        role: 'assistant',
        content: null,
        tool_calls: [syntheticCall],
      };
      const resultMsg: ToolResultMessage = await executeToolCall(
        supabase,
        userId,
        syntheticCall,
        userMessage,
        onToolCall,
        onPrefillProposal,
        actorId
      );
      loopMessages.push(assistantMsg, resultMsg);
      enriched.push(assistantMsg, resultMsg);
    }
  }

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const res = await fetch(toolEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${toolKey}`, 'Content-Type': 'application/json' },
      // Belt & braces with the outer race: the provider socket itself is
      // aborted at the same deadline so no orphaned request lingers.
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: modelToUse,
        messages: loopMessages,
        tools: availableTools,
        tool_choice: 'auto',
        stream: false,
        // Enough headroom for the analyze_website → prefill chain, where one
        // assistant message carries up to 3 prefill_entity_form calls with
        // full descriptions. Plain routing turns use far less.
        max_tokens: 1200,
      }),
    });
    if (!res.ok) {
      break;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    // Model stopped calling tools → it has what it needs; the main chat call
    // produces the final answer from the gathered context.
    if (choice?.finish_reason !== 'tool_calls' || !choice.message?.tool_calls?.length) {
      break;
    }

    const assistantMsg = choice.message as ToolCallAssistantMessage;

    // Programmatic search guard: on a clear create intent, drop search_platform
    // calls (the weak model emits them despite the routing prompt) so no
    // tool_call is left unfulfilled in the thread.
    let toolCalls = assistantMsg.tool_calls;
    if (hasCreateIntent(userMessage)) {
      const kept = toolCalls.filter(tc => tc.function?.name !== 'search_platform');
      if (kept.length !== toolCalls.length) {
        toolCalls = kept;
      }
    }
    // Cross-step dedupe: drop prefill calls re-drafting an entity type that an
    // earlier step already drafted (see prefilledTypes above).
    toolCalls = toolCalls.filter(
      tc => tc.function?.name !== 'prefill_entity_form' || !prefilledTypes.has(prefillType(tc))
    );
    if (toolCalls.length === 0) {
      break;
    }

    const assistantToolMsg: ToolCallAssistantMessage = { ...assistantMsg, tool_calls: toolCalls };
    loopMessages.push(assistantToolMsg);
    enriched.push(assistantToolMsg);

    for (const toolCall of toolCalls) {
      const resultMessage = await executeToolCall(
        supabase,
        userId,
        toolCall,
        userMessage,
        onToolCall,
        onPrefillProposal,
        actorId
      );
      loopMessages.push(resultMessage);
      enriched.push(resultMessage);
      if (toolCall.function?.name === 'prefill_entity_form') {
        prefilledTypes.add(prefillType(toolCall));
      }
    }
    // Loop continues — the model now sees these results and may call another
    // tool (e.g. refine a search) or stop.
  }

  return enriched;
}
