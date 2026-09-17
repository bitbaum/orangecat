import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain ESM script module, no types on purpose.
import { readRateLimitHeaders } from '../../../scripts/eval-rate-limit.mjs';

/**
 * The nightly Cat eval stood down every night from 2026-09-10 with
 * "free-model budget 0/0 remaining — SKIPPED". The free model was answering
 * fine; OpenRouter had simply stopped sending x-ratelimit-* headers, and
 * `Number(null)` is 0, which is finite. Unknown was laundered into empty and
 * the gate that validates prompt changes silently never ran.
 */

const headers = (map: Record<string, string>) => new Headers(map);

describe('readRateLimitHeaders', () => {
  it('returns null when the headers are absent — unknown is not empty', () => {
    expect(readRateLimitHeaders(headers({}))).toBeNull();
    expect(readRateLimitHeaders(headers({ 'content-type': 'application/json' }))).toBeNull();
  });

  it('returns null when remaining is present but not a number', () => {
    expect(readRateLimitHeaders(headers({ 'x-ratelimit-remaining': 'unlimited' }))).toBeNull();
    expect(readRateLimitHeaders(headers({ 'x-ratelimit-remaining': '' }))).toBeNull();
  });

  it('reads a real zero as zero — the reserve check must still be able to fire', () => {
    expect(
      readRateLimitHeaders(headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-limit': '50' }))
    ).toEqual({ limit: 50, remaining: 0, reset: null });
  });

  it('reads a full set of headers', () => {
    expect(
      readRateLimitHeaders(
        headers({
          'x-ratelimit-remaining': '37',
          'x-ratelimit-limit': '50',
          'x-ratelimit-reset': '1789150000000',
        })
      )
    ).toEqual({ limit: 50, remaining: 37, reset: 1789150000000 });
  });

  it('keeps remaining when only the limit is missing', () => {
    expect(readRateLimitHeaders(headers({ 'x-ratelimit-remaining': '12' }))).toEqual({
      limit: null,
      remaining: 12,
      reset: null,
    });
  });
});
