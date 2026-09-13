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

import { readingFromRefusalBody, type QuotaReading } from '@bitbaum/ai-kit';

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
/**
 * The daily pool Groq enforces and never puts in a header.
 *
 * Groq meters THREE limits and publishes TWO. Tokens-per-minute and
 * requests-per-day arrive as `x-ratelimit-*`; a tokens-per-DAY pool is stated
 * once, in prose, inside the body of the 429 that enforces it:
 *
 *   Rate limit reached for model `openai/gpt-oss-20b` in organization `org_…`
 *   service tier `on_demand` on tokens per day (TPD): Limit 200000,
 *   Used 199773, Requested 571. Please try again in 2m28.608s.
 *
 * So every header can read healthy through a total outage — measured on
 * Loki production 2026-09-13, where the headers said 999 of 1000 requests
 * remained while every call was refused and users got 503s.
 *
 * Keyed by MODEL even though the pool is org-wide, because that is the only id
 * the refusal gives us and the skip below is applied per link. The effect is
 * the same: each model that sees the refusal stops being dialled.
 */
const dailyPoolSpentUntil = new Map<string, number>();

/** How long to stand down when the refusal names no retry time. */
const DEFAULT_DAILY_STAND_DOWN_MS = 15 * 60 * 1000;

/**
 * Learn from a Groq refusal.
 *
 * Returns the reading when the body named a DAILY pool — and stands the model
 * down until the reset the refusal names. Returns null for anything else,
 * including an ordinary per-minute limit, which must not sideline a model for
 * the rest of the day.
 */
export function recordGroqRefusal(
  model: string,
  body: string | null | undefined,
  retryAfterSeconds: number | null = null,
  now: number = Date.now()
): QuotaReading | null {
  if (!body) {
    return null;
  }
  const reading = readingFromRefusalBody(
    {
      provider: {
        id: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        keyEnv: 'GROQ_API_KEY',
        models: [model],
        dailyTokens: 0,
      },
      model,
    },
    body,
    retryAfterSeconds,
    now
  );
  // Only a DAY window stands a model down. A per-minute refusal is transient
  // and the chain's ordinary retry handles it; treating it as daily would
  // sideline a healthy model for a quarter of an hour on one busy second.
  //
  // NOTE the absence of a `remaining > 0` guard, which the first draft had and
  // production disproves. Loki's refusal on 2026-09-13 read "Limit
  // 200000, Used 199773" — 227 tokens left, and every call refused, because no
  // real request fits in 227 tokens. The vendor has just declined a live
  // request on this basis, so the day IS spent; `remaining` is a detail for the
  // report, not a reason to keep dialling.
  if (!reading || reading.window !== 'day') {
    return null;
  }
  dailyPoolSpentUntil.set(model, reading.resetAt ?? now + DEFAULT_DAILY_STAND_DOWN_MS);
  return reading;
}

/**
 * Is this model's daily pool known to be spent right now?
 *
 * False when we have never seen a refusal — never asked is not the same as
 * fine, and guessing "spent" would take a working model out of the chain on no
 * evidence at all.
 */
export function isGroqDailyPoolSpent(model: string, now: number = Date.now()): boolean {
  const until = dailyPoolSpentUntil.get(model);
  if (until === undefined) {
    return false;
  }
  if (now >= until) {
    dailyPoolSpentUntil.delete(model);
    return false;
  }
  return true;
}

/** Test seam: forget every observed refusal. */
export function resetGroqDailyPool(): void {
  dailyPoolSpentUntil.clear();
}

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
