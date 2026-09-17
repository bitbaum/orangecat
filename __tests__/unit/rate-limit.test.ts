// @vitest-environment jsdom
/**
 * rate-limit — the VALUES are app semantics, so they are asserted here.
 *
 * limitkit deliberately ships no limits: how many writes a user gets per
 * minute is OrangeCat's decision, and this file is where that decision is
 * pinned. If a number below changes, it must be because someone changed the
 * policy in src/lib/rate-limit.ts on purpose — not because a refactor of the
 * algorithm quietly moved it.
 *
 * The limiters are module-level singletons sharing in-process stores, so every
 * test uses its own random key: tests must not consume each other's budgets.
 */

import {
  rateLimit,
  rateLimitWriteAsync,
  rateLimitSocialAsync,
  rateLimitTipRecipient,
  rateLimitPaymentClaim,
  rateLimitL402Verify,
  rateLimitAskCat,
  rateLimitDomainSearch,
  rateLimitIntegrationKeyWrite,
  rateLimitIntegrationKeyRead,
  rateLimitAction,
  ACTION_RATE_LIMITS,
  rateLimitHeaders,
  createRateLimitResponse,
  type RateLimitResult,
} from '@/lib/rate-limit';

let n = 0;
const uniq = () => `test-${Date.now()}-${n++}`;

const req = (ip: string) =>
  ({ headers: { get: (k: string) => (k === 'x-forwarded-for' ? ip : null) } }) as Request;

async function exhaust(
  check: () => Promise<RateLimitResult>,
  expectedLimit: number
): Promise<RateLimitResult> {
  let last: RateLimitResult | undefined;
  for (let i = 0; i < expectedLimit; i++) {
    last = await check();
    expect(last.success).toBe(true);
    expect(last.limit).toBe(expectedLimit);
  }
  const refused = await check();
  expect(refused.success).toBe(false);
  expect(refused.remaining).toBe(0);
  expect(last!.remaining).toBe(0);
  return refused;
}

describe('rate limit values (policy pins)', () => {
  it('general per-IP: 100 per 15 minutes', async () => {
    const ip = `203.0.113.${(n % 200) + 1}-${uniq()}`;
    await exhaust(() => rateLimit(req(ip)), 100);
  });

  it('writes: 30 per minute per user', async () => {
    const user = uniq();
    await exhaust(() => rateLimitWriteAsync(user), 30);
  });

  it('social actions: 10 per minute per user', async () => {
    const user = uniq();
    await exhaust(() => rateLimitSocialAsync(user), 10);
  });

  it('tip invoices: 20 per 5 minutes per recipient, case-insensitive key', async () => {
    const name = `Recipient-${uniq()}`;
    const refused = await exhaust(() => rateLimitTipRecipient(name), 20);
    expect(refused.success).toBe(false);
    // Same budget however the username is cased.
    expect((await rateLimitTipRecipient(name.toUpperCase())).success).toBe(false);
  });

  it('payment claims: 10 per hour per recipient', async () => {
    const id = uniq();
    await exhaust(() => rateLimitPaymentClaim('project', id), 10);
  });

  it('L402 verify: 60 per minute per intent', async () => {
    const intent = uniq();
    await exhaust(() => rateLimitL402Verify(intent), 60);
  });

  it('ask-cat: 8 per 5 minutes per IP', async () => {
    const ip = `198.51.100.9-${uniq()}`;
    await exhaust(() => rateLimitAskCat(req(ip)), 8);
  });

  it('domain search: 10 per 5 minutes per IP', async () => {
    const ip = `198.51.100.10-${uniq()}`;
    await exhaust(() => rateLimitDomainSearch(req(ip)), 10);
  });

  it('integration keys: 60 writes and 300 reads per minute by default', async () => {
    const writeKey = uniq();
    const readKey = uniq();
    await exhaust(() => rateLimitIntegrationKeyWrite(writeKey), 60);
    await exhaust(() => rateLimitIntegrationKeyRead(readKey), 300);
  });

  it('named actions: MESSAGE_SEND 60/min, CONVERSATION_CREATE 10/min', async () => {
    expect(ACTION_RATE_LIMITS.MESSAGE_SEND).toEqual({ requests: 60, windowMs: 60_000 });
    expect(ACTION_RATE_LIMITS.CONVERSATION_CREATE).toEqual({ requests: 10, windowMs: 60_000 });
    const who = uniq();
    await exhaust(() => rateLimitAction('CONVERSATION_CREATE', who), 10);
  });

  it('a refused key recovers without waiting out its own refusals', async () => {
    // limitkit counts nothing on refusal: hammering past the limit must not
    // extend the window. The refusal's resetTime is when the OLDEST counted
    // hit ages out, not "now + window".
    const user = uniq();
    const before = Date.now();
    const refused = await exhaust(() => rateLimitSocialAsync(user), 10);
    expect(refused.resetTime).toBeLessThanOrEqual(before + 60_000 + 1000);
  });
});

describe('rate limit headers (ADR-0002 spec via limitkit)', () => {
  it('emits X-RateLimit-* with Reset in epoch seconds, no Retry-After on success', () => {
    const resetTime = Date.now() + 30_000;
    const headers = rateLimitHeaders({ success: true, limit: 30, remaining: 12, resetTime });
    expect(headers['X-RateLimit-Limit']).toBe('30');
    expect(headers['X-RateLimit-Remaining']).toBe('12');
    expect(headers['X-RateLimit-Reset']).toBe(String(Math.ceil(resetTime / 1000)));
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('adds Retry-After (>= 1s) on refusals', () => {
    const headers = rateLimitHeaders({
      success: false,
      limit: 30,
      remaining: 0,
      resetTime: Date.now() + 45_000,
    });
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(44);
    expect(Number(headers['Retry-After'])).toBeLessThanOrEqual(46);
  });

  it('createRateLimitResponse keeps the 429 envelope and standard headers', async () => {
    const result = { success: false, limit: 8, remaining: 0, resetTime: Date.now() + 10_000 };
    const res = createRateLimitResponse(result);
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('8');
    expect(res.headers.get('Retry-After')).not.toBeNull();
    const body = await res.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.limit).toBe(8);
  });
});
