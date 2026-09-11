/**
 * Read OpenRouter's rate-limit headers into a budget, or admit you cannot.
 *
 * Extracted from scripts/eval-cat.mjs because it hid a bug that silenced the
 * nightly Cat eval for days: `Number(headers.get('x-ratelimit-remaining'))`
 * turns a MISSING header into 0, and 0 is finite, so "OpenRouter sent no
 * rate-limit headers" was read as "0 of 0 requests remaining" and the eval
 * stood down every night to protect a reserve that was not in danger.
 * Measured 2026-09-11 from the box: HTTP 200, the free model answering, and no
 * x-ratelimit-* header on the response at all.
 *
 * Unknown is not the same as empty. Absent headers -> null -> the run proceeds.
 * A pure function so it can be tested without the script's env preconditions.
 *
 * @param {{ get(name: string): string | null }} headers
 * @returns {{ limit: number | null, remaining: number, reset: number | null } | null}
 */
export function readRateLimitHeaders(headers) {
  const rawRemaining = headers.get('x-ratelimit-remaining');
  if (rawRemaining === null || rawRemaining === undefined || rawRemaining === '') {
    return null;
  }
  const remaining = Number(rawRemaining);
  if (!Number.isFinite(remaining)) {
    return null;
  }
  const rawLimit = headers.get('x-ratelimit-limit');
  const rawReset = headers.get('x-ratelimit-reset');
  const limit = rawLimit === null || rawLimit === '' ? null : Number(rawLimit);
  const reset = rawReset === null || rawReset === '' ? null : Number(rawReset);
  return {
    limit: Number.isFinite(limit) ? limit : null,
    remaining,
    reset: Number.isFinite(reset) ? reset : null,
  };
}
