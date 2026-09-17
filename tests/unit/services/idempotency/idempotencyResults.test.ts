/**
 * Idempotency-Key dedup — pure-function contract tests.
 *
 * The SDK relies on canonical-JSON body hashing to dedupe retries
 * regardless of how the client serialised the payload. If object-key
 * ordering ever stops being canonicalised, two technically-identical
 * requests would compute different hashes, miss each other, and the
 * server would execute both — silently breaking the at-most-once
 * promise the docs publish.
 *
 * These tests lock that contract down. They're pure functions, no
 * Supabase mock needed.
 *
 * Created: 2026-06-03
 */

import { hashRequestBody, shouldCacheStatus } from '@/services/idempotency/idempotencyResults';

describe('hashRequestBody', () => {
  it('produces a stable sha256 hex digest', () => {
    const h = hashRequestBody({ a: 1 });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('treats object key order as irrelevant', () => {
    // Different client serialisation; same logical body.
    const a = hashRequestBody({ title: 'x', price_btc: 0.001, currency: 'BTC' });
    const b = hashRequestBody({ currency: 'BTC', title: 'x', price_btc: 0.001 });
    const c = hashRequestBody({ price_btc: 0.001, currency: 'BTC', title: 'x' });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('recurses into nested objects', () => {
    const a = hashRequestBody({ meta: { source: 'loki', priority: 1 } });
    const b = hashRequestBody({ meta: { priority: 1, source: 'loki' } });
    expect(a).toBe(b);
  });

  it('treats array order as significant (arrays are ordered data)', () => {
    const a = hashRequestBody({ tags: ['x', 'y'] });
    const b = hashRequestBody({ tags: ['y', 'x'] });
    expect(a).not.toBe(b);
  });

  it('different scalar values produce different hashes', () => {
    expect(hashRequestBody({ n: 1 })).not.toBe(hashRequestBody({ n: 2 }));
    expect(hashRequestBody({ s: 'a' })).not.toBe(hashRequestBody({ s: 'b' }));
    expect(hashRequestBody({ b: true })).not.toBe(hashRequestBody({ b: false }));
  });

  it('null and undefined values are distinguishable', () => {
    expect(hashRequestBody(null)).not.toBe(hashRequestBody({}));
    expect(hashRequestBody({ x: null })).not.toBe(hashRequestBody({}));
  });

  it('handles primitives at the root', () => {
    expect(hashRequestBody(null)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRequestBody('hello')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRequestBody(42)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRequestBody(true)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces identical hashes for empty object vs empty object', () => {
    expect(hashRequestBody({})).toBe(hashRequestBody({}));
  });

  it('distinguishes empty object from empty array', () => {
    expect(hashRequestBody({})).not.toBe(hashRequestBody([]));
  });
});

describe('shouldCacheStatus', () => {
  // The docs.api.CONVENTIONS.md §4 contract: 5xx is never cached.
  it.each([200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 499])('%d → cacheable', status => {
    expect(shouldCacheStatus(status)).toBe(true);
  });

  it.each([500, 502, 503, 504, 599])('%d → NOT cacheable (5xx may recover on retry)', status => {
    expect(shouldCacheStatus(status)).toBe(false);
  });

  it('boundary: 199 is below valid range and not cacheable', () => {
    expect(shouldCacheStatus(199)).toBe(false);
  });

  it('boundary: 500 is the first non-cacheable code', () => {
    expect(shouldCacheStatus(499)).toBe(true);
    expect(shouldCacheStatus(500)).toBe(false);
  });
});
