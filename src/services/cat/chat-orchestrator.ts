/**
 * Cat Chat Orchestrator
 *
 * Owns the orchestration for POST /api/cat/chat so the route stays a thin
 * wrapper. Handles provider resolution, context fetching, memory recall,
 * prompt building, the tool/search pass, the model call with rate-limit
 * fallback chain, the streaming vs non-streaming responses, persistence, and
 * the detached memory-extraction step.
 *
 * Behavior is identical to the previous inline handler — streaming semantics
 * and the fire-and-forget `extractAndStoreMemories` detachment are preserved.
 */

import { z } from 'zod';
import { logger } from '@/utils/logger';
import { apiSuccess } from '@/lib/api/standardResponse';
import type { AuthenticatedRequest } from '@/lib/api/withAuth';
import { applyRateLimitHeaders, type RateLimitResult } from '@/lib/rate-limit';
import { prepareCatChat } from '@/services/cat/chat-prepare';
import { enforceGrounding } from '@/services/cat/grounding';
import { parseActionsFromResponse } from '@/services/cat/response-parser';
import { messageMightNeedTools } from '@/services/cat/tool-use-detection';
import { saveMessages } from '@/services/cat/conversation-history';
import { buildFailedTurnMessages } from '@/services/cat/failed-turn';
import { alertCatChatFailure } from '@/services/cat/failure-alert';
import { resolveProvider, type FallbackProvider } from '@/services/cat/provider-resolver';
import { actionsViaForModel, observedToolVerdict } from '@/services/cat/tool-capability';
import { meterCreditUsage } from '@/services/cat/credit-metering';
import { getAdminClient } from '@/lib/supabase/admin';
import { extractAndStoreMemories } from '@/services/cat/memory';
import { extractAndStoreEconomicProfile } from '@/services/cat/economic-profile';
import {
  maybeEnrichWithSearchResults,
  type ToolAugmentedMessage,
  type ToolCallEvent,
  type PrefillProposal,
} from '@/services/cat/tool-use';
import { isAgenticModel } from '@/config/model-capability';
import { runExecActions } from '@/services/cat/exec-actions';
import { getUserActorId } from '@/domain/actors';
import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';
import { PAGE_EXCERPT_MAX_CHARS } from '@/config/cat-page-context';
import { markLinkDown } from '@/services/ai/link-health';
import { isGroqDailyPoolSpent } from '@/services/ai/groq-capacity';
import { EmptyCompletion, hasUsableContent } from '@/services/cat/empty-completion';
import { promptFitsGroqOnDemand, GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq';
import { getGroqTpmLimit, recordOpenRouterRateLimit } from '@/services/ai/groq-capacity';
import { CHAT_IMAGE_MAX_COUNT, chatImageSchema, withImages } from '@/services/cat/chat-images';
import { storeChatImages } from '@/services/cat/chat-image-store';
import { imageRefsIn, withImageRefs } from '@/lib/chat/attachment-tags';
import { imageFieldOf } from '@/lib/ai/assist-target';

export const catChatBodySchema = z.object({
  message: z.string().min(1).max(AI_MESSAGE_MAX_CHARS),
  /** Photos for this turn — see chat-images.ts. The message carries their tags. */
  images: z.array(chatImageSchema).max(CHAT_IMAGE_MAX_COUNT).optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
  /** Target conversation. Omitted → the user's default conversation. */
  conversationId: z.string().guid().optional(),
  /**
   * Runtime session hints from the client. Optional and untrusted — the server
   * validates each field. Drive Cat's locale, price quoting, and recent-page
   * awareness. See RuntimeContext in document-context-types.ts.
   */
  preferredCurrency: z.string().max(8).optional(),
  locale: z.string().max(20).optional(),
  lastVisitedPath: z.string().max(200).optional(),
  /** The page the user is on right now (global Cat overlay), + its entity if any. */
  currentPath: z.string().max(200).optional(),
  currentEntity: z.object({ type: z.string().max(32), ref: z.string().max(120) }).optional(),
  /**
   * Verbatim excerpt of what's visible on the current page (client-captured,
   * capped at PAGE_EXCERPT_MAX_CHARS + ellipsis). Grounds "help me with this
   * page" in the real page instead of a guessed one.
   */
  pageExcerpt: z
    .string()
    .max(PAGE_EXCERPT_MAX_CHARS + 1)
    .optional(),
});

export type CatChatBody = z.infer<typeof catChatBodySchema>;

/**
 * Shown when the model finishes without producing ANY content. The client
 * renders an empty last assistant message as eternal typing dots (no error,
 * no reply — a "hang" to the user), so the stream must always deliver at
 * least one honest sentence.
 */
export const EMPTY_REPLY_FALLBACK =
  "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?";

/**
 * Sentinel for a chain link skipped by pre-flight instead of attempted. A
 * PLATFORM Groq link deterministically 413s once the assembled prompt exceeds
 * Groq's on-demand TPM limit — paying that round-trip on every message adds
 * latency and log noise for a guaranteed failure. Skips must NOT mark the
 * link down globally: other users' smaller prompts still fit it.
 */
class GroqPreflightSkip extends Error {
  constructor() {
    super('platform Groq skipped pre-flight: prompt exceeds the on-demand TPM limit');
    this.name = 'GroqPreflightSkip';
  }
}

/** True when this link is platform Groq and the prompt clearly won't fit it. */
function overflowsPlatformGroq(
  provider: string,
  hasByok: boolean,
  model: string,
  messages: ToolAugmentedMessage[]
): boolean {
  if (provider !== 'groq' || hasByok) {
    return false;
  }
  // A day that is already spent is as certain a failure as a prompt that does
  // not fit, and it is learned the same way — from the refusal itself. Without
  // this, every message pays a guaranteed 429 round-trip to Groq before the
  // chain moves on, for however many hours remain until the pool resets.
  //
  // It stands down only what the vendor actually refused, and only until the
  // reset time the refusal names. A model never refused is never skipped:
  // "not asked" is not "spent".
  if (isGroqDailyPoolSpent(model)) {
    return true;
  }
  return !promptFitsGroqOnDemand(messages, model);
}

/**
 * Headroom left under the per-minute cap after the reply reserve: slack for
 * the estimate itself, which counts characters rather than tokenising. The
 * estimate errs high, but a tokeniser disagreeing by a few percent on an 8 000
 * budget is the difference between a reply and a 413.
 */
const PROMPT_BUDGET_MARGIN_TOKENS = 150;

/**
 * A 429 from OpenRouter's free pool names the day it ran out
 * (`free-models-per-day`). Remembering that is what lets the capacity meter
 * say "resets at 00:00 UTC" instead of the app's old guess, "try again in a
 * minute" — which was a lie for the one refusal a wait never fixes.
 */
function noteRateLimit(provider: string, err: unknown): void {
  if (provider === 'openrouter' && err instanceof Error) {
    recordOpenRouterRateLimit(err.message);
  }
}

/**
 * Provider-agnostic rate-limit detection. Every AI provider error class we ship
 * (GroqAPIError, OpenRouterAPIError, OpenAICompatibleAPIError) carries a
 * `statusCode` field — 429 means rate limit, full stop. Some providers also
 * surface a `type: 'rate_limit'` discriminator. Check both first because
 * they're cheap and unambiguous; fall back to message-pattern matching.
 */
export function isAiRateLimitError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const e = error as { statusCode?: number; type?: string };
    if (e.statusCode === 429) {
      return true;
    }
    if (e.type === 'rate_limit') {
      return true;
    }
  }

  // Message-pattern fallback. Different providers phrase rate-limit
  // messages differently — Groq says "rate limit" or "tokens per minute,"
  // OpenRouter says "rate-limited upstream," Together says "too many
  // requests" or "rate limit exceeded." Match all common variants.
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('rate limit') ||
      msg.includes('rate-limit') ||
      msg.includes('ratelimit') ||
      msg.includes('tokens per minute') ||
      msg.includes('request too large') ||
      msg.includes('too many requests') ||
      msg.includes('429')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Record which link actually answered the turn.
 *
 * Losses were logged here and wins were not, so the box sweep that divides one
 * by the other could only ever see losses — a provider failing every call and
 * one answering every call produced the same silence, because the fallback
 * chain served both identically. `{ always: true }` because production logs at
 * `warn`, and a counter a monitor reads must outlive the log level.
 *
 * Only the link is recorded. Never the message, never the answer.
 */
function logServed(provider: string, model: string): void {
  logger.info('Cat chat: model call served', { link: `${provider}/${model}` }, 'cat/chat', {
    always: true,
  });
}

// ==================== ONE TURN ====================
//
// orchestrateCatChat reads as its phases: resolve who answers, prepare the
// turn (prompt, budget, actor, photo), then either stream it or answer it in
// one piece. Both halves share CatTurn, everything decided before a model is
// called.
//
// Behaviour is pinned by __tests__/unit/cat/chat-orchestrator.characterization.test.ts
// (every SSE frame and side effect, recorded from the pre-split orchestrator)
// and by the source pins in chat-logs-the-win / chips-survive-a-reload.

type ResolvedTurnProvider = Exclude<Awaited<ReturnType<typeof resolveProvider>>, Response>;

/** Everything about this turn that is settled before any model is called. */
interface CatTurn {
  request: AuthenticatedRequest;
  body: CatChatBody;
  resolved: ResolvedTurnProvider;
  /** The message as saved: each photo's private storage path in its tag. */
  storedMessage: string;
  /** Ledger idempotency ref for a metered exchange; null when not metered. */
  meterRef: string | null;
  actorId: string | null;
  prepared: Awaited<ReturnType<typeof prepareCatChat>>;
  conversationId: string | null;
  /** Advisory: drives the `suggestUpgrade` hint only. */
  wantsAgentic: boolean;
  baseMessages: ToolAugmentedMessage[];
  /** Puts the turn's draft photo, if any, on a prefill proposal. */
  withDraftPhoto: (proposal: PrefillProposal) => PrefillProposal;
}

/**
 * Orchestrate a single Cat chat exchange and return the HTTP Response.
 *
 * The caller (route) has already authenticated, applied the rate limit, and
 * validated the body. This function runs the full pipeline and returns either
 * a streaming SSE Response or a buffered JSON Response — both with rate-limit
 * headers applied. The non-streaming path may throw; the route's outer catch
 * turns those into the appropriate error responses.
 */
export async function orchestrateCatChat(
  request: AuthenticatedRequest,
  body: CatChatBody,
  rl: RateLimitResult
): Promise<Response> {
  const { user, supabase } = request;

  // Resolve provider, BYOK keys, model, and platform limits
  const resolved = await resolveProvider(supabase, user.id, request.headers, {
    requestedModel: body.model,
    message: body.message,
    hasImages: Boolean(body.images?.length),
  });
  if (resolved instanceof Response) {
    return resolved;
  }

  const turn = await prepareTurn(request, body, resolved);
  if (body.stream) {
    return streamCatChat(turn, rl);
  }
  return answerCatChat(turn, rl);
}

/**
 * The budget for the prompt: built to FIT the link that will answer, rather
 * than discovering it does not. The free Groq pool refuses any single request
 * over its per-minute cap (8 000 tokens for the models this key serves, reply
 * reserve included) — and Cat's system prompt alone measured 9 100 tokens in
 * tool mode on 2026-09-11, so platform Groq could not serve one message. Every
 * turn paid a guaranteed 413, fell through to OpenRouter's free pool, and
 * exhausted THAT by mid-morning; the user then read "Free AI capacity is
 * maxed out right now" for the rest of the day.
 *
 * The budget is the smallest cap among the platform-Groq links in this
 * user's chain. A BYOK chain, or one with no Groq link, gets the whole
 * prompt: their limits are their own and usually far higher.
 */
function promptTokenBudget(resolved: ResolvedTurnProvider): number | undefined {
  const { provider, hasByok, modelToUse, fallbacks } = resolved;
  const platformGroqModels = [
    { provider, hasByok, model: modelToUse },
    ...fallbacks.map(f => ({ provider: f.provider, hasByok: f.hasByok, model: f.modelToUse })),
  ]
    .filter(link => link.provider === 'groq' && !link.hasByok)
    .map(link => link.model);
  return platformGroqModels.length > 0
    ? Math.min(...platformGroqModels.map(m => getGroqTpmLimit(m))) -
        GROQ_CHAT_MAX_TOKENS -
        PROMPT_BUDGET_MARGIN_TOKENS
    : undefined;
}

/** Store the photos, resolve the actor, and assemble the prompt for this turn. */
async function prepareTurn(
  request: AuthenticatedRequest,
  body: CatChatBody,
  resolved: ResolvedTurnProvider
): Promise<CatTurn> {
  const { user, supabase } = request;
  const { message, images } = body;

  // What is saved: the same message, with each photo's private storage path
  // in its tag — so the thread can show the photo and the Cat can put it on
  // what it drafts. The model still reads `message`.
  const imageRefs = images?.length ? await storeChatImages(user.id, images) : [];
  const storedMessage = withImageRefs(
    message,
    imageRefs.map(r => r ?? '')
  );
  const { modelToUse, metered, toolEndpoint, toolKey } = resolved;

  // One stable id per request — the ledger idempotency ref for a metered
  // (credit-paid frontier) exchange.
  const meterRef = metered ? `cat_chat_${crypto.randomUUID()}` : null;

  // Resolve actor ID for exec_action execution
  const actorId = await getUserActorId(supabase, user.id);

  // Prompt assembly (context + memories + custom instructions + history)
  // lives in chat-prepare — shared with /api/cat/prepare so LOCAL models
  // (Ollama / LM Studio in the user's browser) get the identical brain.
  // Does this provider get native tool definitions? If so the prose catalog is
  // 18k chars of duplicate (ADR-0006 D7); if not, the exec_action text path is
  // Cat's only way to act and the prose has to stay. Same predicate the tool
  // layer branches on, so the prompt cannot promise what the call won't send.
  //
  // Decided from the PRIMARY provider and not rebuilt when the chain falls back
  // mid-stream, which is safe in both directions: a 'tools' prompt reaching a
  // provider with no tools leaves Cat without a catalog, so it does not claim
  // to act; a 'prose' prompt reaching a tool-capable one just describes the
  // envelope twice, and the exec_action text path still executes it. Neither
  // ends with the user being told something happened that did not.
  // The prompt's claim must track what will ACTUALLY be sent. `'tools'` drops
  // the prose action catalogue because definitions replace it, so claiming it
  // when no definitions go out leaves Cat with no verb at all — neither the
  // loop nor the prose envelope. That is why the credentials are part of the
  // question, not just the model's capability.
  const actionsVia = actionsViaForModel(
    modelToUse,
    Boolean(toolEndpoint && toolKey),
    observedToolVerdict(modelToUse, toolKey)
  );

  const prepared = await prepareCatChat(supabase, user.id, {
    message,
    requestedConversationId: body.conversationId,
    preferredCurrency: body.preferredCurrency,
    locale: body.locale,
    lastVisitedPath: body.lastVisitedPath,
    currentPath: body.currentPath,
    currentEntity: body.currentEntity,
    pageExcerpt: body.pageExcerpt,
    actionsVia,
    tokenBudget: promptTokenBudget(resolved),
  });
  // What fitting the budget cost, when it cost anything. Logged rather than
  // silent: a prompt that reaches the model without the user's context is a
  // different answer, and the reason has to be findable.
  if (
    prepared.budget &&
    (!prepared.budget.fits ||
      prepared.budget.historyDropped > 0 ||
      prepared.budget.contextTruncated ||
      prepared.budget.contextDropped ||
      prepared.budget.fewShotDropped ||
      prepared.budget.sectionsDropped.length > 0)
  ) {
    logger.info(
      'Cat chat: prompt fitted to the free-tier budget',
      { ...prepared.budget },
      'cat/chat'
    );
  }

  // Does this message want more than chat (discovery, creation, multi-step)?
  // If so AND the answering model isn't agentic (frontier), we flag the
  // response so the UI can gently suggest upgrading to a more powerful model.
  // Uses the same signal that gates tool use — one source of truth.
  // Advisory ONLY: drives the `suggestUpgrade` hint in the done event. This
  // is no longer a gate on tools (ADR-0006 D3) — it just guesses whether the
  // user would benefit from an agentic model, and a wrong guess costs a hint.
  const wantsAgentic = messageMightNeedTools(message);

  const baseMessages: ToolAugmentedMessage[] = prepared.messages;

  // The photo a draft listing should carry: this turn's, else the latest one
  // in the recent thread ("sell this" → "make it a digital download" is two
  // turns). Only a PRIVATE ref here; nothing is published until the user acts.
  const draftPhotoRef =
    imageRefs.find((r): r is string => Boolean(r)) ??
    imageRefsIn(
      baseMessages.filter(m => m.role === 'user').map(m => String(m.content ?? ''))
    ).pop() ??
    null;
  const withDraftPhoto = (proposal: PrefillProposal): PrefillProposal => {
    const field = draftPhotoRef ? imageFieldOf(proposal.entityType) : null;
    return field && draftPhotoRef
      ? { ...proposal, photo: { ref: draftPhotoRef, field } }
      : proposal;
  };

  return {
    request,
    body,
    resolved,
    storedMessage,
    meterRef,
    actorId,
    prepared,
    conversationId: prepared.conversationId,
    wantsAgentic,
    baseMessages,
    withDraftPhoto,
  };
}

// ==================== STREAMING ====================

type StreamUsage =
  | {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      costBtc?: number;
    }
  | undefined;

/**
 * What a streaming turn learns as it runs. Created before the try so the
 * failure path can tell whether the failover attempt was reached, which link
 * was active when the chain died, and persist whatever text had already
 * streamed.
 */
interface StreamState {
  attemptedFallback: boolean;
  activeProvider: string;
  activeModel: string;
  activeService: ResolvedTurnProvider['aiService'];
  activeIsPlatform: boolean;
  fullContent: string;
  usage: StreamUsage;
  /**
   * After any content has streamed it's too late to swap providers cleanly
   * without corrupting the response, so we only failover when nothing has
   * been sent to the user yet.
   */
  streamStarted: boolean;
}

/** One SSE writer per stream; each call enqueues exactly what it did inline before. */
interface SseOut {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}

function sendData(out: SseOut, payload: unknown): void {
  out.controller.enqueue(out.encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

function streamCatChat(turn: CatTurn, rl: RateLimitResult): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      await runStreamingTurn(turn, { controller, encoder });
    },
  });
  return applyRateLimitHeaders(
    new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }),
    rl
  );
}

/** The whole streamed turn: the stream is always closed, success or failure. */
async function runStreamingTurn(turn: CatTurn, out: SseOut): Promise<void> {
  const { provider, modelToUse, aiService, hasByok } = turn.resolved;
  const state: StreamState = {
    attemptedFallback: false,
    activeProvider: provider,
    activeModel: modelToUse,
    activeService: aiService,
    activeIsPlatform: !hasByok,
    fullContent: '',
    usage: undefined,
    streamStarted: false,
  };
  try {
    sendData(out, { model: modelToUse, provider });

    // Everything Cat read from the web this turn, as evidence blocks
    // labelled with the citation handle that licenses each one. Fed to
    // the grounding check below so a figure Cat correctly quoted from a
    // page is recognised as quoted rather than flagged as invented.
    const webEvidence: string[] = [];
    const streamedToolCalls: ToolCallEvent[] = [];
    const messages = await runStreamingToolPhase(turn, out, streamedToolCalls, webEvidence);

    await walkStreamingChain(turn, out, state, messages, webEvidence);
    await settleStreamedTurn(turn, state, streamedToolCalls);
  } catch (err) {
    await failStreamedTurn(turn, out, state, err);
  } finally {
    out.controller.close();
  }
}

/**
 * Tool use happens INSIDE the stream so we can surface each lifecycle event
 * ('running' → completed/no_results/failed) to the user in real time as
 * `tool_call` SSE events. Prefill proposals (the prefill_entity_form tool)
 * emit a second event type carrying the structured draft so the UI can render
 * a PrefilledFormCard instead of narrating field values as prose.
 */
function runStreamingToolPhase(
  turn: CatTurn,
  out: SseOut,
  streamedToolCalls: ToolCallEvent[],
  webEvidence: string[]
): Promise<ToolAugmentedMessage[]> {
  const { user, supabase } = turn.request;
  const { provider, modelToUse, toolEndpoint, toolKey, fallbacks } = turn.resolved;
  return maybeEnrichWithSearchResults(
    supabase,
    user.id,
    turn.baseMessages,
    turn.body.message,
    provider,
    modelToUse,
    (event: ToolCallEvent) => {
      // Kept as well as sent. The SSE frame reaches the live tab and
      // nothing else; without this copy the chips exist only in that
      // tab's React state and a reload erases what Cat did.
      streamedToolCalls.push(event);
      sendData(out, { tool_call: event });
    },
    (proposal: PrefillProposal) => {
      sendData(out, { prefill_proposal: turn.withDraftPhoto(proposal) });
    },
    // ADR-0006 D2 — with an actor, the tool phase may also EXECUTE
    // actions, so their outcome is in the messages the model writes
    // from. Without one nothing can be created, and the phase stays
    // read-only.
    {
      actorId: turn.actorId,
      // The active step's own endpoint and key, so a BYOK user's tools
      // reach THEIR vendor rather than being silently dropped.
      toolEndpoint,
      toolKey,
      toolFallbacks: fallbacks,
      onWebEvidence: evidence => {
        webEvidence.push(...evidence);
      },
    }
  );
}

/**
 * Close the answer: guarantee content, check and repair groundedness, run the
 * actions it asks for, and send the `done` frame.
 */
async function emitDone(
  turn: CatTurn,
  out: SseOut,
  state: StreamState,
  webEvidence: string[]
): Promise<void> {
  const { user, supabase } = turn.request;
  // Completion guarantee: a model that finishes without emitting any
  // content (e.g. it tried to "call a tool" the main completion
  // doesn't have) would leave the client's last assistant bubble
  // empty — rendered as typing dots forever. Always send at least
  // one honest sentence before closing.
  if (!state.fullContent.trim()) {
    state.fullContent = EMPTY_REPLY_FALLBACK;
    sendData(out, { content: state.fullContent });
  }
  // Groundedness check, then a one-shot repair.
  //
  // Streaming makes this awkward and the compromise is deliberate: the
  // fabricated text has already reached the screen by the time it can
  // be checked, so the repair cannot un-say it live. What it CAN do is
  // fix the two things that outlast the moment — what gets persisted
  // into the conversation, and what the client renders once told — so
  // a reload never shows the fabrication and the model never reads its
  // own invention back as history next turn.
  //
  // Scoped to entity-attribution: Cat must stay free to name Lightning,
  // Twint or PayPal in general advice. See @bitbaum/ai-kit/grounding verify.
  const groundingCheck = await enforceGrounding({
    content: state.fullContent,
    message: turn.body.message,
    grounding: {
      ...turn.prepared.grounding,
      // Pages and results Cat actually read this turn count as
      // evidence. Without this the citation handles would be
      // decorative: the verifier would flag every real figure Cat
      // correctly quoted from a source as a novel number, and the
      // repair pass would delete the researched half of the answer.
      evidence: [...turn.prepared.grounding.evidence, ...webEvidence],
    },
    service: state.activeService,
    model: state.activeModel,
    userId: user.id,
    conversationId: turn.conversationId,
  });
  const correctedContent = groundingCheck.corrected;
  if (correctedContent) {
    // Everything downstream — action parsing, persistence — must run on
    // the repaired text. Parsing actions from the ORIGINAL would let a
    // claim we just deleted still drive a side effect.
    state.fullContent = correctedContent;
  }

  const { actions, quickReplies } = parseActionsFromResponse(state.fullContent);
  const execResults = await runExecActions(supabase, user.id, turn.actorId, actions);
  sendData(out, {
    done: true,
    usage: state.usage,
    model: state.activeModel,
    provider: state.activeProvider,
    actions: actions.length > 0 ? actions : undefined,
    execResults: execResults.length > 0 ? execResults : undefined,
    quickReplies,
    suggestUpgrade: turn.wantsAgentic && !isAgenticModel(state.activeModel),
    grounding: {
      ok: groundingCheck.ok,
      unsupported: groundingCheck.violations.map(v => v.text).slice(0, 8),
    },
    ...(correctedContent ? { correctedContent } : {}),
  });
}

/**
 * Stream one link's answer to the client. Nothing streamed is a failed link
 * (EmptyCompletion), not a finished answer.
 */
async function consumeStream(
  turn: CatTurn,
  out: SseOut,
  state: StreamState,
  messages: ToolAugmentedMessage[],
  webEvidence: string[]
): Promise<void> {
  const { activeProvider, activeModel, activeService } = state;
  let doneEmitted = false;
  for await (const chunk of activeService.streamChatCompletion({
    model: activeModel,
    messages: withImages(messages, turn.body.images),
    temperature: 0.7,
  })) {
    if (chunk.usage) {
      state.usage = chunk.usage;
    }
    if (chunk.content) {
      state.streamStarted = true;
      state.fullContent += chunk.content;
      sendData(out, { content: chunk.content });
    }
    if (chunk.done) {
      if (!state.streamStarted) {
        throw new EmptyCompletion(activeProvider, activeModel);
      }
      await emitDone(turn, out, state, webEvidence);
      doneEmitted = true;
      logServed(activeProvider, activeModel);
      break;
    }
  }
  // Provider stream ended without a done chunk. Same rule: nothing
  // streamed is a failed link, not a finished answer. Finalising here
  // is what made an empty 200 look like a completed reply.
  if (!doneEmitted) {
    if (!state.streamStarted) {
      throw new EmptyCompletion(activeProvider, activeModel);
    }
    await emitDone(turn, out, state, webEvidence);
  }
}

/**
 * Remember a dead PLATFORM link so the next message's chain skips it for a
 * minute instead of paying the failed round-trip again. BYOK links are never
 * marked — the user's own key failing must not sideline the platform's
 * identical provider+model. A pre-flight skip is never marked either: this
 * user's prompt is too big for the link, other users' prompts may fit it fine.
 */
function markFailedLink(isPlatform: boolean, provider: string, model: string, err: unknown): void {
  if (isPlatform && !(err instanceof GroqPreflightSkip)) {
    noteRateLimit(provider, err);
    markLinkDown(provider, model);
  }
}

/**
 * Walk the fallback chain on ANY pre-stream failure — rate-limit, retired
 * model id (404), upstream 5xx. A single dead link must never end the chat
 * while a later link could serve it. Each provider gets one attempt. We can
 * only swap providers BEFORE any content streams — otherwise the client sees
 * half a response and then a switch. Throws when the chain ends in an error.
 */
async function walkStreamingChain(
  turn: CatTurn,
  out: SseOut,
  state: StreamState,
  messages: ToolAugmentedMessage[],
  webEvidence: string[]
): Promise<void> {
  const { provider, hasByok, modelToUse, fallbacks } = turn.resolved;
  let lastErr: unknown = null;
  // Pre-flight: a platform-Groq primary deterministically 413s once
  // the prompt outgrows the on-demand TPM limit — skip the guaranteed
  // failure when another link can serve. BYOK Groq (possibly a higher
  // tier) and a chain with no other links still get the real attempt.
  if (fallbacks.length > 0 && overflowsPlatformGroq(provider, hasByok, modelToUse, messages)) {
    lastErr = new GroqPreflightSkip();
  } else {
    try {
      await consumeStream(turn, out, state, messages, webEvidence);
    } catch (err) {
      lastErr = err;
    }
  }
  let fallbackIndex = 0;
  while (lastErr && !state.streamStarted && fallbackIndex < fallbacks.length) {
    state.attemptedFallback = true;
    const reason = isAiRateLimitError(lastErr) ? 'rate_limit' : 'provider_error';
    markFailedLink(state.activeIsPlatform, state.activeProvider, state.activeModel, lastErr);
    const next = fallbacks[fallbackIndex++];
    if (
      fallbackIndex < fallbacks.length &&
      overflowsPlatformGroq(next.provider, next.hasByok, next.modelToUse, messages)
    ) {
      lastErr = new GroqPreflightSkip();
      continue;
    }
    state.activeIsPlatform = !next.hasByok;
    logger.warn(
      'Cat chat: provider failed, trying next fallback',
      {
        from: { provider: state.activeProvider, model: state.activeModel },
        to: { provider: next.provider, model: next.modelToUse },
        reason,
        err: lastErr,
        attempt: fallbackIndex,
      },
      'cat/chat'
    );
    state.activeProvider = next.provider;
    state.activeModel = next.modelToUse;
    state.activeService = next.aiService;
    sendData(out, {
      fallback: { from: provider, to: state.activeProvider, model: state.activeModel, reason },
    });
    sendData(out, { model: state.activeModel, provider: state.activeProvider });
    try {
      await consumeStream(turn, out, state, messages, webEvidence);
      lastErr = null;
    } catch (nextErr) {
      lastErr = nextErr;
    }
  }
  if (lastErr) {
    markFailedLink(state.activeIsPlatform, state.activeProvider, state.activeModel, lastErr);
    // Every link came back empty. NOW the honest sentence is right —
    // it is the chain's verdict rather than the first link's. Throwing
    // instead would replace today's polite ending with an error page,
    // which would be a regression for the one case where the apology
    // was always the correct answer.
    if (lastErr instanceof EmptyCompletion && !state.streamStarted) {
      await emitDone(turn, out, state, webEvidence);
    } else {
      throw lastErr;
    }
  }
}

/** Persist the streamed turn, learn from it, and bill or count it. */
async function settleStreamedTurn(
  turn: CatTurn,
  state: StreamState,
  streamedToolCalls: ToolCallEvent[]
): Promise<void> {
  const { user, supabase } = turn.request;
  const { conversationId } = turn;
  const { metered, modelToUse, hasByok, keyService } = turn.resolved;
  const { fullContent, usage, activeModel, activeProvider, activeService } = state;
  if (conversationId && fullContent) {
    saveMessages(supabase, conversationId, user.id, [
      { role: 'user', content: turn.storedMessage },
      {
        role: 'assistant',
        content: fullContent,
        model_used: activeModel,
        provider: activeProvider,
        token_count: usage?.totalTokens,
        // What Cat DID, stored with what it said. Held only in React
        // state before, so a reload erased the chips — and with them
        // the sources behind the citations in this very sentence.
        tool_calls: streamedToolCalls,
      },
    ]).catch((err: unknown) => {
      logger.error('Failed to persist streaming messages', { err }, 'cat/chat');
    });
    // Learn durable facts from this exchange for future turns. Fully
    // best-effort and detached — never blocks or fails the response.
    void extractAndStoreMemories(
      supabase,
      user.id,
      conversationId,
      turn.body.message,
      fullContent,
      activeService,
      activeModel
    );
    // Reliably populate the economic-profile store from the same exchange —
    // deterministic, not dependent on the chat model emitting an action.
    void extractAndStoreEconomicProfile(
      supabase,
      user.id,
      turn.body.message,
      fullContent,
      activeService,
      activeModel
    );
  }
  if (metered && turn.meterRef && usage?.totalTokens && activeModel === modelToUse) {
    // Credit-paid frontier exchange: debit the ledger for the model
    // that actually served. If a rate-limit fallback answered instead
    // (activeModel changed), the user is NOT billed.
    await meterCreditUsage(getAdminClient() as never, user.id, {
      model: activeModel,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      rawCostBtc: usage.costBtc,
      ref: turn.meterRef,
      conversationId,
    });
  } else if (!hasByok && usage?.totalTokens) {
    await keyService.incrementPlatformUsage(user.id, 1, usage.totalTokens);
  }
}

/**
 * Honest error copy. Never echo raw err.message — it can contain API keys
 * (e.g. a malformed Authorization header leaks the credential in the
 * Headers.append error). Log server-side; return a structured, actionable
 * error to the client. Only claim what we actually know — "providers are
 * down" when the real cause was a config bug erodes trust and sends users
 * chasing outages.
 */
function streamErrorPayload(
  err: unknown,
  hasByok: boolean,
  attemptedFallback: boolean
): { error: string; code: string } {
  if (isAiRateLimitError(err)) {
    return {
      error: hasByok
        ? 'Your provider returned a rate-limit. Try again in a moment.'
        : 'Free AI capacity is maxed out right now. Try again in a minute — or add your own free Groq key in Settings → AI for capacity that’s all yours.',
      code: 'AI_RATE_LIMITED',
    };
  }
  if (attemptedFallback) {
    // The whole chain threw — quota exhaustion, retired model ids,
    // or a revoked platform key. From the user's side the action is
    // the same; the details are in the server log either way.
    return {
      error: hasByok
        ? 'None of your providers could answer just now. Check your keys in Settings → AI, then try again.'
        : 'Cat couldn’t reach an AI model just now — this is usually momentary. Try again; if it keeps happening, add your own free Groq key in Settings → AI.',
      code: 'ALL_PROVIDERS_DOWN',
    };
  }
  return {
    error: 'Cat couldn’t generate a response. Try again, or add your own key in Settings → AI.',
    code: 'STREAM_ERROR',
  };
}

/** End a failed stream honestly: log, persist the turn, alert, send an error event. */
async function failStreamedTurn(
  turn: CatTurn,
  out: SseOut,
  state: StreamState,
  err: unknown
): Promise<void> {
  const { user, supabase } = turn.request;
  const { hasByok } = turn.resolved;
  const { attemptedFallback, activeProvider, activeModel } = state;
  logger.error(
    'Cat chat stream error',
    { err, attemptedFallback, hasByok, provider: activeProvider, model: activeModel },
    'cat/chat'
  );
  const errPayload = streamErrorPayload(err, hasByok, attemptedFallback);
  // Persist the turn even though it failed. The success path saves
  // only `if (fullContent)`, so before this a total provider failure
  // threw away the user's own words: they reloaded to an empty thread
  // and we kept no record of what they had asked. Six real accounts
  // reached exactly this state in June 2026 — one message-less
  // conversation each, never seen again — and because an unsaved turn
  // is indistinguishable from "opened the page and typed nothing",
  // those failures were invisible in the data too.
  //
  // The assistant turn stores the same sentence the user just saw, so
  // the thread reads back honestly, and the user/assistant alternation
  // the next request's history depends on stays intact.
  if (turn.conversationId) {
    await saveMessages(
      supabase,
      turn.conversationId,
      user.id,
      buildFailedTurnMessages({
        message: turn.storedMessage,
        partialContent: state.fullContent,
        errorText: errPayload.error,
        model: activeModel,
        provider: activeProvider,
      })
    ).catch((persistErr: unknown) => {
      logger.error('Failed to persist failed turn', { persistErr }, 'cat/chat');
    });
  }
  // Raise it with the operator too. Persisting the turn makes the
  // failure visible to anyone who goes looking; this makes it visible
  // to someone who isn't looking. Detached and self-swallowing — a
  // chat that already failed must not fail differently because the
  // alert could not be written.
  void alertCatChatFailure({
    userId: user.id,
    code: errPayload.code,
    provider: activeProvider,
    model: activeModel,
  });
  out.controller.enqueue(out.encoder.encode(`event: error\n`));
  sendData(out, errPayload);
}

// ==================== NON-STREAMING ====================

type Completion = Awaited<ReturnType<ResolvedTurnProvider['aiService']['chatCompletion']>>;

/** The link that answered a buffered turn, and how the chain got there. */
interface ChainAnswer {
  result: Completion;
  /** Set when a fallback, not the primary, answered. */
  fellBackTo: FallbackProvider | null;
  activeProvider: string;
}

/**
 * Try primary; on ANY failure (rate-limit, retired model id, upstream 5xx),
 * walk the fallback chain. Non-streaming is even safer than streaming because
 * each attempt is atomic — no partial-content corruption risk to worry about.
 * Throws the last error when no link produced an answer.
 */
async function walkCompletionChain(
  turn: CatTurn,
  messages: ToolAugmentedMessage[]
): Promise<ChainAnswer> {
  const { provider, hasByok, modelToUse, aiService, fallbacks } = turn.resolved;
  const images = turn.body.images;
  let activeProvider: string = provider;
  let result: Completion | undefined;
  let fellBackTo: FallbackProvider | null = null;
  let lastErr: unknown = null;
  // Same pre-flight as the streaming path: never pay a guaranteed 413 on a
  // platform-Groq link when another link can serve this prompt.
  if (fallbacks.length > 0 && overflowsPlatformGroq(provider, hasByok, modelToUse, messages)) {
    lastErr = new GroqPreflightSkip();
  } else {
    try {
      result = await aiService.chatCompletion({
        model: modelToUse,
        messages: withImages(messages, images),
        temperature: 0.7,
      });
      // `while (!result && ...)` below treats any object as an answer, so an
      // empty 200 stopped the walk before a working link was ever tried.
      if (!hasUsableContent(result?.content)) {
        result = undefined;
        lastErr = new EmptyCompletion(provider as string, modelToUse);
      }
    } catch (err) {
      lastErr = err;
    }
  }
  let fallbackIndex = 0;
  let lastTried = { provider: provider as string, model: modelToUse, platform: !hasByok };
  while (!result && lastErr && fallbackIndex < fallbacks.length) {
    markFailedLink(lastTried.platform, lastTried.provider, lastTried.model, lastErr);
    const next = fallbacks[fallbackIndex++];
    lastTried = { provider: next.provider, model: next.modelToUse, platform: !next.hasByok };
    if (
      fallbackIndex < fallbacks.length &&
      overflowsPlatformGroq(next.provider, next.hasByok, next.modelToUse, messages)
    ) {
      lastErr = new GroqPreflightSkip();
      continue;
    }
    logger.warn(
      'Cat chat (non-streaming): provider failed, trying next fallback',
      {
        from: provider,
        to: next.provider,
        model: next.modelToUse,
        reason: isAiRateLimitError(lastErr) ? 'rate_limit' : 'provider_error',
        err: lastErr,
        attempt: fallbackIndex,
      },
      'cat/chat'
    );
    try {
      result = await next.aiService.chatCompletion({
        model: next.modelToUse,
        messages: withImages(messages, images),
        temperature: 0.7,
      });
      if (!hasUsableContent(result?.content)) {
        result = undefined;
        lastErr = new EmptyCompletion(next.provider, next.modelToUse);
        continue;
      }
      fellBackTo = next;
      activeProvider = next.provider;
      lastErr = null;
    } catch (nextErr) {
      lastErr = nextErr;
    }
  }
  if (!result) {
    markFailedLink(lastTried.platform, lastTried.provider, lastTried.model, lastErr);
    throw lastErr ?? new Error('Cat chat: no AI provider produced a response');
  }
  logServed(lastTried.provider, lastTried.model);
  return { result, fellBackTo, activeProvider };
}

/** A buffered turn: tools, the chain, billing, actions, persistence, then one JSON body. */
async function answerCatChat(turn: CatTurn, rl: RateLimitResult): Promise<Response> {
  const { user, supabase } = turn.request;
  const { message } = turn.body;
  const { conversationId } = turn;
  const {
    provider,
    hasByok,
    modelToUse,
    aiService,
    platformUsage,
    keyService,
    metered,
    fallbacks,
    toolEndpoint,
    toolKey,
  } = turn.resolved;

  // Buffer tool calls + prefill proposals so the JSON response can carry
  // them alongside the answer.
  const collectedToolCalls: ToolCallEvent[] = [];
  const collectedPrefillProposals: PrefillProposal[] = [];
  const messages = await maybeEnrichWithSearchResults(
    supabase,
    user.id,
    turn.baseMessages,
    message,
    provider,
    modelToUse,
    (event: ToolCallEvent) => {
      collectedToolCalls.push(event);
    },
    (proposal: PrefillProposal) => {
      collectedPrefillProposals.push(turn.withDraftPhoto(proposal));
    },
    // Same as the streaming path: an actor is what makes actions callable.
    { actorId: turn.actorId, toolEndpoint, toolKey, toolFallbacks: fallbacks }
  );
  // The non-streaming path runs no grounding check (see below), so there is
  // nothing here to feed web evidence into. Stated rather than left as an
  // unexplained asymmetry between two call sites of the same function.

  const { result, fellBackTo, activeProvider } = await walkCompletionChain(turn, messages);

  if (metered && turn.meterRef && !fellBackTo) {
    // Credit-paid frontier exchange (non-streaming): debit only when the
    // metered primary served — a fallback answer is a free-tier answer.
    await meterCreditUsage(getAdminClient() as never, user.id, {
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      rawCostBtc: result.costBtc,
      ref: turn.meterRef,
      conversationId,
    });
  } else if (!hasByok) {
    await keyService.incrementPlatformUsage(user.id, 1, result.totalTokens);
  }

  // Same completion guarantee as the streaming path: never hand the client an
  // empty reply (it renders as a hang, not as an answer).
  const rawContent = result.content?.trim() ? result.content : EMPTY_REPLY_FALLBACK;
  const { message: cleanedMessage, actions, quickReplies } = parseActionsFromResponse(rawContent);
  const execResults = await runExecActions(supabase, user.id, turn.actorId, actions);

  if (conversationId) {
    saveMessages(supabase, conversationId, user.id, [
      { role: 'user', content: turn.storedMessage },
      {
        role: 'assistant',
        content: cleanedMessage,
        model_used: result.model,
        provider: activeProvider,
        token_count: result.totalTokens,
        tool_calls: collectedToolCalls,
      },
    ]).catch((err: unknown) => {
      logger.error('Failed to persist messages', { err }, 'cat/chat');
    });
    // Learn durable facts from this exchange (best-effort, detached).
    void extractAndStoreMemories(
      supabase,
      user.id,
      conversationId,
      message,
      cleanedMessage,
      fellBackTo?.aiService ?? aiService,
      fellBackTo?.modelToUse ?? modelToUse
    );
    void extractAndStoreEconomicProfile(
      supabase,
      user.id,
      message,
      cleanedMessage,
      fellBackTo?.aiService ?? aiService,
      fellBackTo?.modelToUse ?? modelToUse
    );
  }

  return applyRateLimitHeaders(
    apiSuccess({
      message: cleanedMessage,
      actions: actions.length > 0 ? actions : undefined,
      quickReplies,
      execResults: execResults.length > 0 ? execResults : undefined,
      toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
      prefillProposals:
        collectedPrefillProposals.length > 0 ? collectedPrefillProposals : undefined,
      modelUsed: result.model,
      provider: activeProvider,
      suggestUpgrade: turn.wantsAgentic && !isAgenticModel(fellBackTo?.modelToUse ?? modelToUse),
      fallback: fellBackTo
        ? {
            from: provider,
            to: fellBackTo.provider,
            model: fellBackTo.modelToUse,
            reason: 'rate_limit',
          }
        : undefined,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        apiCostBtc: result.costBtc || 0,
        isFreeModel: result.isFreeModel,
        usedByok: result.usedByok,
      },
      userStatus: {
        hasByok,
        freeMessagesPerDay: platformUsage?.daily_limit ?? 0,
        freeMessagesRemaining: platformUsage?.requests_remaining ?? 0,
      },
    }),
    rl
  );
}
