/**
 * What a bot turn says, and records, when no link of the shared pool answered.
 *
 * On 2026-11-12 every bot send on the live site failed for hours: Google's
 * link had been switched off and the free links behind it were spent. A
 * person read "That did not go through. Try again.", which led nowhere, and
 * the diagnostics workflow read "0 failures", because it counted the Cat's
 * turns only. Pure, so both halves can be tested without a model.
 */

/** The log source of a bot turn's pool failure (scripts/diagnose-cat-logs.mjs reads it). */
export const BOT_TURN_LOG_SOURCE = 'companions/chat';

/**
 * Shown under the composer with the button to Settings → AI. It names the way
 * out that works whatever the pool does: a person's own key is asked first
 * and the pool is never reached.
 */
export const SHARED_POOL_DOWN_MESSAGE =
  'The free AI tier could not answer just now. Try again shortly, or add your own API key in Settings → AI: your bots then answer on it.';

/**
 * One entry per failed link: the vendor and the HTTP status, nothing else.
 * No error text, model output, prompt or key reaches the log through this:
 * a vendor's message can quote the request.
 */
export function chainFailureSummary(
  failures: ReadonlyArray<{ provider: string; error: unknown }>
): Array<{ provider: string; status: number | null }> {
  return failures.map(f => {
    const e = f.error as { statusCode?: unknown; status?: unknown } | null;
    const candidate = e?.statusCode ?? e?.status;
    const status =
      typeof candidate === 'number' &&
      Number.isInteger(candidate) &&
      candidate >= 400 &&
      candidate <= 599
        ? candidate
        : null;
    return { provider: String(f.provider).slice(0, 40), status };
  });
}
