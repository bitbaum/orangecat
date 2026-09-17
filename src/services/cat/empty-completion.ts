/**
 * A link answered HTTP 200 and said nothing.
 *
 * ── Why this is its own module ───────────────────────────────────────────────
 * This exact misreading has now been shipped twice in this codebase. First in
 * `callPlatformJson`, which returned `content ?? null` — a guard that looks
 * like one and is not, because `??` passes an EMPTY STRING through — and then
 * returned on the first `response.ok`, so an empty completion never fell
 * through to the next vendor. Eight Cat features degraded into silently doing
 * nothing. That instance was fixed where it sat.
 *
 * The SHAPE was not. The chat orchestrator made the same mistake in two more
 * places: the streaming path finalised an empty stream into a canned apology,
 * and the non-streaming path's `while (!result && ...)` treated any object as
 * an answer. Both ended the chat while working links waited one step down the
 * chain.
 *
 * So the decision lives here, once, where it can be tested and reused rather
 * than re-derived a fourth time.
 *
 * ── What actually produces one ───────────────────────────────────────────────
 * Not necessarily a broken model. A REASONING model spends its budget on
 * `reasoning` before it emits any `content`, so too small a `max_tokens` yields
 * a 200 with nothing in it. Demonstrated on Groq `openai/gpt-oss-120b`,
 * 2026-09-13, same prompt, only the budget varied:
 *
 *     max_tokens=16    content=''        finish_reason='length'
 *     max_tokens=24    content=''        finish_reason='length'
 *     max_tokens=64    content='ready'   finish_reason='stop'
 *     max_tokens=256   content='Ready.'  finish_reason='stop'
 *
 * Worth stating plainly because it corrects this module's own first draft: an
 * earlier probe at `max_tokens: 16` reported three OpenRouter free models as
 * returning empty content, and that was the PROBE's fault, not theirs. The
 * genuine vendor faults found the same day were different in kind —
 * `google/gemma-4-31b-it:free` and `google/gemma-4-26b-a4b-it:free` both
 * answered "Provider returned error", which no token budget explains.
 *
 * The handling is what matters, and the cause does not change it. However the
 * emptiness arises — truncation, an upstream hiccup, a model answering only
 * with a tool call it was not offered — a blank reply is not an answer, and
 * scoring it as one ends the turn while working links wait.
 *
 * Production is not currently exposed to the truncation case:
 * GROQ_CHAT_MAX_TOKENS is 1024, far above the threshold above. Falling through
 * on empty is still right, because the user gets nothing either way and the
 * next link might serve.
 */

/**
 * Did this completion actually say anything?
 *
 * Whitespace counts as nothing. A model that emits three spaces has not
 * answered, and passing that on produces a blank bubble rather than a fallback.
 */
export function hasUsableContent(content: string | null | undefined): boolean {
  return typeof content === 'string' && content.trim().length > 0;
}

/**
 * Raised so an empty 200 joins the fallback walk that already exists for
 * thrown errors, instead of being mistaken for a finished answer.
 *
 * Carries the link that produced it, because the caller marks that link down —
 * a model that returns nothing should be skipped on the next message rather
 * than dialled again.
 */
export class EmptyCompletion extends Error {
  readonly provider: string;
  readonly model: string;

  constructor(provider: string, model: string) {
    super(`empty completion from ${provider}/${model}`);
    this.name = 'EmptyCompletion';
    this.provider = provider;
    this.model = model;
  }
}
