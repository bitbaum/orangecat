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
import { toolPlanForModel } from './tool-capability';
import {
  hasCreateIntent,
  hasWebsiteAnalysisIntent,
  PLATFORM_TOOL_DEFINITION,
} from './tool-use-detection';
import { executeToolCall } from './tool-executor';
import { WebTurnContext } from './web-research';
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
export type {
  ChatMessage,
  ToolAugmentedMessage,
  ToolCallResultRef,
  ToolCallEvent,
  OnToolCall,
  PrefillProposal,
  OnPrefillProposal,
} from './tool-use-types';

/**
 * Max model⇄tool round-trips per user turn. Bounds cost and latency; most
 * requests still need 1, some 2 (search → refine, or search → prefill).
 *
 * Raised 3 → 5 when the web tools landed, because at 3 the web was unusable
 * rather than merely limited: the one sequence that makes web research honest
 * — search, then OPEN the most promising result, then answer from the page
 * rather than from a snippet — is itself two steps, leaving nothing for the
 * refinement that a weak first query almost always needs. A ceiling that
 * forces the model to answer from search snippets is a ceiling that
 * manufactures confident wrong numbers.
 *
 * 5 is not the frontier figure and is not meant to be: agents doing real work
 * run to dozens of steps. It is what fits inside a tool phase that blocks the
 * user's stream. Going further means moving the loop off the critical path so
 * it can run long without the user watching typing dots — a bigger change,
 * recorded in ADR-0007 rather than smuggled in here.
 */
const MAX_TOOL_STEPS = 5;

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

/**
 * When the tool phase dies mid-research, the main model is holding a question
 * it was about to look up. Told nothing, it answers from its weights and the
 * user cannot tell that from a researched answer — which is the worst of the
 * three possible outcomes, because it is the only one that looks fine.
 */
const WEB_RESEARCH_FAILED_NOTE =
  'NOTE: A web lookup was started for this message and did not finish (the tool step failed ' +
  'or timed out). You have NOT seen any web content. Answer from what you already know, say ' +
  'plainly that you could not check the web just now, and do NOT state current prices, dates, ' +
  'availability or any other fact that would have needed that lookup.';

/** What the tool phase falls back to when it fails or times out. */
function degradedMessages(
  messages: ToolAugmentedMessage[],
  userMessage: string,
  usedWeb = false
): ToolAugmentedMessage[] {
  if (hasWebsiteAnalysisIntent(userMessage)) {
    return [...messages, { role: 'system', content: WEBSITE_FETCH_FAILED_NOTE }];
  }
  if (usedWeb) {
    return [...messages, { role: 'system', content: WEB_RESEARCH_FAILED_NOTE }];
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
  modelToUse: string,
  onToolCall?: OnToolCall,
  onPrefillProposal?: OnPrefillProposal,
  opts?: {
    timeoutMs?: number;
    actorId?: string | null;
    /**
     * Where to POST the tool loop, and with what, for the ACTIVE model.
     * Supplied by the provider resolver, which is the only place a BYOK key
     * exists in the raw — `aiService` bakes it in and exposes nothing, and
     * `AiService.chatCompletion` drops `tool_calls`, so the loop cannot go
     * through that abstraction either.
     *
     * When absent, the two platform vendors are still derivable from the
     * environment (unchanged behaviour); any other provider gets no tools,
     * exactly as before. That is the fallback, not the intent.
     */
    toolEndpoint?: string | null;
    toolKey?: string | null;
    /**
     * Receives the evidence blocks for everything Cat actually read from the
     * web this turn, so the caller's grounding check can verify the reply
     * against them.
     *
     * Fired ONLY on the path where the tool results reach the model. On the
     * degrade path the model is never shown the web content, so licensing
     * claims against it would let an invented sentence pass because a page we
     * did not show happened to contain the words.
     */
    onWebEvidence?: (evidence: string[]) => void;
  }
): Promise<ToolAugmentedMessage[]> {
  // Can THIS MODEL drive a tool loop? Asked of the model, not of a two-name
  // provider list — that list denied tools to every user on their own OpenAI /
  // Together / xAI key, so whoever paid most got the least capable Cat. An
  // uncatalogued model is ASKED: a registry says where to start, not where to
  // stop. See tool-capability.ts and ADR-0008 D1.
  const plan = toolPlanForModel(modelToUse);
  if (!plan.sendTools) {
    return messages;
  }

  // WHERE to call is the resolver's answer, never a guess. It builds the step,
  // so it holds the only raw BYOK credential, and it supplies platform steps
  // too. NO provider-name fallback: a wrong guess sends a user's own model id
  // to somebody else's vendor with somebody else's key, which is worse than
  // sending no tools.
  const toolEndpoint = opts?.toolEndpoint ?? null;
  const toolKey = opts?.toolKey ?? null;
  if (!toolEndpoint || !toolKey) {
    return messages;
  }

  // The keyword prefilter is GONE as a gate (ADR-0006 D3), and removing it is
  // what makes the in-turn action loop actually fire.
  //
  // It was ~100 English substrings. Measured against five ordinary requests:
  // "create a project called X" passed (via "create a"), while "publish my
  // project", "sell my ebook", "list my mugs for sale" and "make me a service
  // for haircuts" were ALL blocked — so four of five real action phrasings
  // never reached the tools at all, and non-English phrasing fared worse.
  // Deciding whether a tool is needed is the model's job; that is what
  // tool_choice: 'auto' is for.
  //
  // The cost it was buying is one slim routing round-trip on messages that turn
  // out not to need a tool. That call carries the short routing prompt and
  // max_tokens 1200, not the ~52k-char system prompt, so it is a small fraction
  // of the main call — and D7 removes more from the main call than this adds.
  //
  // One thing the gate had been doing by accident: thin input ("we're a
  // bakery") never reached the router, so the main prompt's ask-one-question
  // posture always applied. With the gate gone the router saw it and drafted
  // three entities from one noun (eval probe g-bakery, 2026-09-11). The
  // routing prompt now carries the thin-input rule itself — the router is
  // the one making that call now, so the rule has to live where the call is
  // made.

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

  // Created HERE rather than inside the loop so the degrade path can still ask
  // whether a lookup was in flight when the deadline fired. The loop owns what
  // goes into it; this scope only needs to read `attempted` afterwards.
  const web = new WebTurnContext(userMessage);

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
        web,
      }),
      new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      }),
    ]);
    if (raced === 'timeout') {
      return degradedMessages(messages, userMessage, web.attempted);
    }
    if (web.evidence.length > 0) {
      opts?.onWebEvidence?.(web.evidence);
    }
    return raced;
  } catch {
    return degradedMessages(messages, userMessage, web.attempted);
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
  /** The turn's web state — owned by the caller so it outlives the deadline. */
  web: WebTurnContext;
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
    web,
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
        '- prefill_entity_form: when the user describes something THEY want to create / sell / offer / launch / fundraise (e.g. "I make mugs and want to sell them", "I want to start a project"). This is about THEIR own new thing — if it is for ANOTHER person who is not on OrangeCat ("for my friend Maria", "not for me", "she isn\'t registered"), call the ACTION create_project_for_person instead, never prefill_entity_form (a draft would be the user\'s, not hers). Pick entityType by what the thing IS: selling time/skill/labor (even at a fixed price, "haircuts, 40 CHF") = service; a tangible/digital item = product; fundraising a defined outcome = project; open-ended no-strings support = cause; the user NEEDS money and will repay = loan; a dated gathering = event; renting out something owned = asset; a community organizing itself = circle. Call it ONCE per distinct entity — never twice for the same thing.\n' +
        '- THIN INPUT: if the message only says who they are or what they do with nothing specific to put on OrangeCat ("we\'re a bakery", "I\'m a designer", a job title, a bio), call NO tool at all — do not guess three drafts from one noun. The reply will ask ONE focused question. Draft only when they name a concrete thing to sell, offer, fund, lend, rent or host.\n' +
        '- search_platform: ONLY when the user wants to FIND, discover, or connect with things that already exist on the platform and belong to OTHERS (e.g. "find a designer", "who else is building X"). You may search again with a refined query if the first results are weak.\n' +
        '- suggest_offers: when the user asks what THEY could offer/sell/create, how they could make money or participate, or wants ideas grounded in who they are (e.g. "what can I offer?", "help me make money", "any ideas for me?"). It reads their stored profile/documents/memories — pass no message text, just an optional focus.\n' +
        '- forget_memories: when the user says something you know about them is WRONG or asks you to forget/remove/correct it (e.g. "I don\'t speak French", "that\'s not true, remove it", "forget the weekend thing"). Pass each wrong fact as a short phrase. Stored memories change ONLY through this tool — if the user asks for a correction and you skip it, nothing is saved.\n' +
        '- analyze_website: when the user pastes a website URL or bare domain and wants it read, analyzed, or used to set them up (e.g. "here\'s my site: https://… — set me up on OrangeCat", or a message that is nothing but a domain). Pass the EXACT URL from their message. After you see the extracted site text, follow its instructions: chain prefill_entity_form calls (at most 3, all in one message) for entities the site directly evidences — never for anything the site does not say.\n' +
        '- explore_topic: when the user expresses an INTEREST or curiosity rather than naming a specific thing to find ("I\'m interested in longevity", "anyone working on Bitcoin education?", "introduce me to people doing X"). Pass the topic in their own words. Use this, NOT search_platform, for interests — it also finds the people behind the work so an introduction is possible.\n' +
        '- query_my_data: when the user asks about their OWN stuff or numbers — earnings/sales ("how much did I earn?"), their listings ("what am I selling?"), bookings, wallet balances/goals, unread notifications, open tasks, or a general catch-up ("how am I doing?", "catch me up"). Read-only. Pick the closest topic (listings, earnings, bookings, wallets, notifications, tasks) or "overview" for a broad question.\n' +
        "- web_search: when the answer is not on OrangeCat and not certainly still true — what something costs elsewhere, whether a grant/programme/tool is real and still open, how a thing works, current rules, dates, events, who is active in a field. Prefer it over answering from memory whenever being out of date would matter. Pass a search QUERY, not the user's sentence. This searches the WORLD; search_platform and explore_topic search OrangeCat itself.\n" +
        "- read_page: after web_search, to open the most promising result when the answer needs a real figure, date, name or term rather than a one-line snippet. The url must come from a search result or from the user's own message — one you compose yourself is refused.\n" +
        '- check_cat_health: ONLY when the user asks why the Cat/AI is failing, slow, or not answering, or asks about a system notification mentioning provider failures, eval/harness errors, or Cat health (e.g. "why is my Cat not answering?", "what does this eval error notification mean?"). Takes no arguments.\n' +
        '- check_my_track_record: when the user asks what YOU did for them or how it went (e.g. "what have you done for me?", "did any of your ideas work?", "why should I trust you?"), or before you propose another thing of a kind you may already have proposed. It is about YOUR actions and their outcomes, not the user\'s own numbers (that is query_my_data). Takes no arguments.\n' +
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
        actorId,
        web
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
        actorId,
        web
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
