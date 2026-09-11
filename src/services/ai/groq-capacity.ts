/**
 * What the platform's Groq key can still do right now — learned from Groq, not
 * assumed.
 *
 * Two facts decide whether Cat can answer on the free pool, and until
 * 2026-09-11 the app knew neither:
 *
 *   1. The per-model tokens-per-minute cap. A single request above it is
 *      refused with HTTP 413 ("Limit 8000, Requested 8391"). The code pinned
 *      12 000 from a measurement in August; the org's limit for the models it
 *      actually serves is 8 000, so oversized prompts passed the pre-flight and
 *      failed live, every message, and the free OpenRouter fallback burned its
 *      daily allowance by mid-morning.
 *   2. How much of the pool is left. Groq says so on every response
 *      (x-ratelimit-*), and nothing read it — so Settings could only show the
 *      user's own 10-a-day counter, never why "capacity is maxed out".
 *
 * This module records both from live responses and exposes them to the
 * pre-flight, the prompt budget and the capacity endpoint. In-memory on
 * purpose: the numbers are per-minute and per-day, a restart forgets nothing
 * that matters, and the first response after boot fills them again.
 */

/** Per-model TPM caps measured against the platform key on 2026-09-11. */
export const GROQ_TPM_LIMIT_BY_MODEL: Readonly<Record<string, number>> = {
  'openai/gpt-oss-120b': 8000,
  'openai/gpt-oss-20b': 8000,
  'qwen/qwen3.6-27b': 8000,
  'qwen/qwen3.8-27b': 8000,
  'groq/compound-mini': 70000,
};

/** For a model this file has never measured — the most a free key has shown. */
export const GROQ_TPM_LIMIT_FALLBACK = 12000;

/** Chars per token, erring HIGH (ai-kit: under-estimating admits the 413). */
export const GROQ_CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / GROQ_CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(
  messages: ReadonlyArray<{ content?: string | null }>
): number {
  return messages.reduce((n, m) => n + estimateTokens(m.content), 0);
}

export interface GroqRateLimitObservation {
  model: string;
  /** Requests per day. */
  limitRequests: number | null;
  remainingRequests: number | null;
  /** Tokens per minute. */
  limitTokens: number | null;
  remainingTokens: number | null;
  /** Seconds until each bucket refills, as Groq reported them. */
  resetRequestsSeconds: number | null;
  resetTokensSeconds: number | null;
  /** On a 429 only. */
  retryAfterSeconds: number | null;
  observedAt: string;
}

const observedTpmLimit = new Map<string, number>();
const observations = new Map<string, GroqRateLimitObservation>();
let openRouterFreeDailyCapHitAt: string | null = null;

/** "Limit 8000, Requested 8391" → the two numbers, or null. */
export function parseGroqTooLarge(message: string): { limit: number; requested: number } | null {
  const m = /Limit\s+(\d+),\s*Requested\s+(\d+)/i.exec(message);
  if (!m) return null;
  return { limit: Number(m[1]), requested: Number(m[2]) };
}

/** Record the cap a 413 body names; returns it, or null when the body has none. */
export function recordGroqTooLarge(model: string, message: string): number | null {
  const parsed = parseGroqTooLarge(message);
  if (!parsed) return null;
  observedTpmLimit.set(model, parsed.limit);
  return parsed.limit;
}

/** The TPM cap this key has for `model`: observed, else measured, else the fallback. */
export function getGroqTpmLimit(model: string): number {
  return (
    observedTpmLimit.get(model) ??
    observations.get(model)?.limitTokens ??
    GROQ_TPM_LIMIT_BY_MODEL[model] ??
    GROQ_TPM_LIMIT_FALLBACK
  );
}

/** Groq's reset strings: "7.66s", "2m59.56s", "1h2m3s", "59ms". */
export function parseGroqResetSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    matched = true;
    const n = Number(m[1]);
    total += m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : m[2] === 'ms' ? n / 1000 : n;
  }
  return matched ? Math.round(total * 10) / 10 : null;
}

type HeaderSource = Headers | Record<string, string | undefined>;

function header(source: HeaderSource, name: string): string | null {
  if (typeof (source as Headers).get === 'function') {
    return (source as Headers).get(name);
  }
  const record = source as Record<string, string | undefined>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
}

function int(value: string | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Read Groq's rate-limit headers off a response for the PLATFORM key. */
export function recordGroqRateLimitHeaders(
  model: string,
  headers: HeaderSource,
  now: Date = new Date()
): GroqRateLimitObservation | null {
  const limitTokens = int(header(headers, 'x-ratelimit-limit-tokens'));
  const limitRequests = int(header(headers, 'x-ratelimit-limit-requests'));
  if (limitTokens === null && limitRequests === null) {
    return null;
  }
  const observation: GroqRateLimitObservation = {
    model,
    limitRequests,
    remainingRequests: int(header(headers, 'x-ratelimit-remaining-requests')),
    limitTokens,
    remainingTokens: int(header(headers, 'x-ratelimit-remaining-tokens')),
    resetRequestsSeconds: parseGroqResetSeconds(header(headers, 'x-ratelimit-reset-requests')),
    resetTokensSeconds: parseGroqResetSeconds(header(headers, 'x-ratelimit-reset-tokens')),
    retryAfterSeconds: int(header(headers, 'retry-after')),
    observedAt: now.toISOString(),
  };
  observations.set(model, observation);
  return observation;
}

export function getGroqObservations(): GroqRateLimitObservation[] {
  return [...observations.values()];
}

/** OpenRouter's free pool is per day, org-wide; a 429 naming it means "until 00:00 UTC". */
export function recordOpenRouterRateLimit(message: string, now: Date = new Date()): boolean {
  if (!/free-models-per-day/i.test(message)) return false;
  openRouterFreeDailyCapHitAt = now.toISOString();
  return true;
}

export function getOpenRouterFreeStatus(now: Date = new Date()): {
  dailyCapHitAt: string | null;
  resetsAt: string | null;
} {
  if (!openRouterFreeDailyCapHitAt) return { dailyCapHitAt: null, resetsAt: null };
  const hit = new Date(openRouterFreeDailyCapHitAt);
  const reset = new Date(Date.UTC(hit.getUTCFullYear(), hit.getUTCMonth(), hit.getUTCDate() + 1));
  if (now >= reset) {
    openRouterFreeDailyCapHitAt = null;
    return { dailyCapHitAt: null, resetsAt: null };
  }
  return { dailyCapHitAt: openRouterFreeDailyCapHitAt, resetsAt: reset.toISOString() };
}

/** Test seam. */
export function resetGroqCapacityForTests(): void {
  observedTpmLimit.clear();
  observations.clear();
  openRouterFreeDailyCapHitAt = null;
}
