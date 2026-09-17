/**
 * What Groq tells us about the free pool, and what we do with it.
 *
 * Groq reports remaining requests-per-day and tokens-per-minute on every
 * response, and names the real per-minute cap in the body of a 413. Nothing
 * read either until 2026-09-11, which is why the app could only say "Free AI
 * capacity is maxed out right now. Try again in a minute" — a guess, and the
 * wrong one for a daily cap.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GROQ_TPM_LIMIT_BY_MODEL,
  GROQ_TPM_LIMIT_FALLBACK,
  estimateTokens,
  getGroqObservations,
  getGroqTpmLimit,
  getOpenRouterFreeStatus,
  parseGroqResetSeconds,
  parseGroqTooLarge,
  recordGroqRateLimitHeaders,
  recordGroqTooLarge,
  recordOpenRouterRateLimit,
  resetGroqCapacityForTests,
} from '@/services/ai/groq-capacity';

beforeEach(() => resetGroqCapacityForTests());

describe('the cap the 413 names', () => {
  it("reads Groq's own numbers out of the refusal", () => {
    expect(
      parseGroqTooLarge(
        'Request too large for model `openai/gpt-oss-120b` in organization `org_x` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8391, please reduce your message size'
      )
    ).toEqual({ limit: 8000, requested: 8391 });
  });

  it('ignores a body that names no limit', () => {
    expect(parseGroqTooLarge('Request too large')).toBeNull();
    expect(recordGroqTooLarge('m', 'Request too large')).toBeNull();
  });

  it('a learned cap outranks the measured table', () => {
    expect(getGroqTpmLimit('openai/gpt-oss-120b')).toBe(
      GROQ_TPM_LIMIT_BY_MODEL['openai/gpt-oss-120b']
    );
    recordGroqTooLarge('openai/gpt-oss-120b', 'TPM: Limit 6000, Requested 9000');
    expect(getGroqTpmLimit('openai/gpt-oss-120b')).toBe(6000);
  });

  it('an unknown model falls back rather than guessing generously', () => {
    expect(getGroqTpmLimit('some/new-model')).toBe(GROQ_TPM_LIMIT_FALLBACK);
  });
});

describe('the headroom the headers report', () => {
  it('records limits, remainders and resets', () => {
    const observation = recordGroqRateLimitHeaders(
      'openai/gpt-oss-120b',
      new Headers({
        'x-ratelimit-limit-requests': '1000',
        'x-ratelimit-remaining-requests': '994',
        'x-ratelimit-limit-tokens': '8000',
        'x-ratelimit-remaining-tokens': '7200',
        'x-ratelimit-reset-requests': '2m59.56s',
        'x-ratelimit-reset-tokens': '7.66s',
      })
    );
    expect(observation).toMatchObject({
      limitRequests: 1000,
      remainingRequests: 994,
      limitTokens: 8000,
      remainingTokens: 7200,
      resetRequestsSeconds: 179.6,
      resetTokensSeconds: 7.7,
    });
    expect(getGroqObservations()).toHaveLength(1);
  });

  it('a response without rate-limit headers records nothing', () => {
    expect(
      recordGroqRateLimitHeaders('m', new Headers({ 'content-type': 'application/json' }))
    ).toBeNull();
    expect(getGroqObservations()).toHaveLength(0);
  });

  it('reads every unit Groq uses for a reset', () => {
    expect(parseGroqResetSeconds('59ms')).toBe(0.1);
    expect(parseGroqResetSeconds('7.66s')).toBe(7.7);
    expect(parseGroqResetSeconds('2m59.56s')).toBe(179.6);
    expect(parseGroqResetSeconds('1h2m3s')).toBe(3723);
    expect(parseGroqResetSeconds('')).toBeNull();
    expect(parseGroqResetSeconds(null)).toBeNull();
  });
});

describe("OpenRouter's free pool is a DAY, not a minute", () => {
  it('remembers the daily cap and reports the UTC reset', () => {
    const hit = new Date('2026-09-11T10:45:00Z');
    expect(recordOpenRouterRateLimit('Rate limit exceeded: free-models-per-day.', hit)).toBe(true);
    const status = getOpenRouterFreeStatus(hit);
    expect(status.dailyCapHitAt).toBe(hit.toISOString());
    expect(status.resetsAt).toBe('2026-09-12T00:00:00.000Z');
  });

  it('clears itself once the day turns', () => {
    const hit = new Date('2026-09-11T23:59:00Z');
    recordOpenRouterRateLimit('free-models-per-day', hit);
    expect(getOpenRouterFreeStatus(new Date('2026-09-12T00:00:01Z')).dailyCapHitAt).toBeNull();
  });

  it('a per-minute 429 is not a spent day', () => {
    expect(recordOpenRouterRateLimit('Rate limit exceeded: requests per minute')).toBe(false);
    expect(getOpenRouterFreeStatus().dailyCapHitAt).toBeNull();
  });
});

describe('the token estimate errs high', () => {
  it('counts a prompt at more tokens than a tokeniser would', () => {
    // ~4 chars/token is the usual rule; 3.5 deliberately over-counts, because
    // under-estimating is exactly how the 413 got through the pre-flight.
    const text = 'x'.repeat(3500);
    expect(estimateTokens(text)).toBe(1000);
    expect(estimateTokens(text)).toBeGreaterThan(3500 / 4);
  });
});
