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
 * ── Why it matters more than it sounds ───────────────────────────────────────
 * An empty 200 is not a rare edge. Probed live on 2026-09-13 against
 * OpenRouter's free tier, of six catalogued, zero-priced, tool-declaring models
 * exactly ONE produced text: two answered "Provider returned error" and THREE
 * returned a 200 with empty content. On a free tier this is the majority shape
 * of a model failing, and it is the only one that a naive client scores as a
 * success.
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
