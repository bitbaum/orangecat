/**
 * HTTP 402 inline payment (L402-style) — pure helpers + route behavior.
 *
 * The route wraps the account-less support rails in the 402 convention:
 * challenge without auth, cryptographic preimage verification on retry.
 */

import { createHash, randomBytes } from 'crypto';
import {
  parseL402Authorization,
  preimageMatchesHash,
  buildL402ChallengeHeader,
} from '@/domain/payments/l402-codec';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Route tests: mock the response layer (NextResponse unavailable in jest) and
// the domain flows; exercise branch selection + status codes.
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown, _opts?: unknown) => ({
    status: 200,
    json: async () => ({ success: true, data }),
    headers: new Map(),
  }),
  apiBadRequest: (message: string, details?: unknown) => ({
    status: 400,
    json: async () => ({ success: false, error: { message, details } }),
    headers: new Map(),
  }),
  apiNotFound: (message: string) => ({
    status: 404,
    json: async () => ({ success: false, error: { message } }),
    headers: new Map(),
  }),
  apiRateLimited: (message: string) => ({
    status: 429,
    json: async () => ({ success: false, error: { message } }),
    headers: new Map(),
  }),
  apiInternalError: (message: string) => ({
    status: 500,
    json: async () => ({ success: false, error: { message } }),
    headers: new Map(),
  }),
  apiPaymentRequired: (message: string, details?: unknown, wwwAuthenticate?: string) => {
    const headers = new Map<string, string>();
    if (wwwAuthenticate) headers.set('WWW-Authenticate', wwwAuthenticate);
    return {
      status: 402,
      json: async () => ({ success: false, error: { code: 'PAYMENT_REQUIRED', message, details } }),
      headers,
    };
  },
}));

const mockCreateChallenge = vi.fn();
const mockVerify = vi.fn();
vi.mock('@/domain/payments/l402', () => ({
  createL402Challenge: (...args: unknown[]) => mockCreateChallenge(...args),
  verifyL402Payment: (...args: unknown[]) => mockVerify(...args),
}));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({ _kind: 'public' }) }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  rateLimitPaymentRecipient: vi.fn().mockResolvedValue({ success: true }),
  rateLimitL402Verify: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: () => 1,
}));

import { GET } from '@/app/api/v1/pay/[entity_type]/[entity_id]/route';
import {
  rateLimitL402Verify,
  rateLimitPaymentRecipient,
  rateLimitWriteAsync,
} from '@/lib/rate-limit';

import type { Mock } from 'vitest';

const ENTITY_ID = '11111111-2222-3333-4444-555555555555';
const params = Promise.resolve({ entity_type: 'product', entity_id: ENTITY_ID });

/** Minimal Request stand-in — the route only touches headers + url. */
function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  return { url, headers: new Headers(headers) } as unknown as Request;
}

// ── pure helpers ─────────────────────────────────────────────────────────────

describe('preimageMatchesHash', () => {
  it('accepts the real sha256 relationship and rejects everything else', () => {
    const preimage = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
    expect(preimageMatchesHash(preimage, hash)).toBe(true);
    expect(preimageMatchesHash(preimage, hash.toUpperCase())).toBe(true);
    expect(preimageMatchesHash(randomBytes(32).toString('hex'), hash)).toBe(false);
    // Wrong length / non-hex never match (and never throw).
    expect(preimageMatchesHash('abcd', hash)).toBe(false);
    expect(preimageMatchesHash('z'.repeat(64), hash)).toBe(false);
  });
});

describe('parseL402Authorization', () => {
  const preimage = 'a'.repeat(64);
  it('parses L402 and legacy LSAT schemes', () => {
    for (const scheme of ['L402', 'LSAT']) {
      const creds = parseL402Authorization(`${scheme} ${ENTITY_ID}.tok_abc:${preimage}`);
      expect(creds).toEqual({
        paymentIntentId: ENTITY_ID,
        statusToken: 'tok_abc',
        preimage,
      });
    }
  });
  it('rejects malformed headers', () => {
    expect(parseL402Authorization(null)).toBeNull();
    expect(parseL402Authorization('Bearer xyz')).toBeNull();
    expect(parseL402Authorization('L402 no-dot-token:' + preimage)).toBeNull();
    expect(parseL402Authorization(`L402 ${ENTITY_ID}.tok:`)).toBeNull();
    expect(parseL402Authorization(`L402 ${ENTITY_ID}.tok:nothex!`)).toBeNull();
  });
});

describe('buildL402ChallengeHeader', () => {
  it('formats token + invoice, omitting invoice when absent', () => {
    expect(
      buildL402ChallengeHeader({ paymentIntentId: 'id1', statusToken: 't1', bolt11: 'lnbc1x' })
    ).toBe('L402 token="id1.t1", invoice="lnbc1x"');
    expect(
      buildL402ChallengeHeader({ paymentIntentId: 'id1', statusToken: 't1', bolt11: null })
    ).toBe('L402 token="id1.t1"');
  });
});

// ── route ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/pay/{type}/{id}', () => {
  beforeEach(() => {
    mockCreateChallenge.mockReset();
    mockVerify.mockReset();
  });

  it('answers 402 with a WWW-Authenticate challenge when unauthenticated', async () => {
    mockCreateChallenge.mockResolvedValue({
      header: 'L402 token="i.t", invoice="lnbc1"',
      payment_intent_id: 'i',
      status_token: 't',
      bolt11: 'lnbc1',
      onchain_address: null,
      amount_btc: 0.0001,
      expires_in_seconds: 600,
      method_label: 'Lightning (NWC)',
    });
    const res = await GET(
      makeRequest(`https://orangecat.ch/api/v1/pay/product/${ENTITY_ID}?amount_btc=0.0001`),
      { params }
    );
    expect(res.status).toBe(402);
    expect(res.headers.get('WWW-Authenticate')).toBe('L402 token="i.t", invoice="lnbc1"');
    const body = await res.json();
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(body.error.details.bolt11).toBe('lnbc1');
    expect(body.error.details.token).toBe('i.t');
  });

  it('rejects a challenge request without a valid amount', async () => {
    const res = await GET(makeRequest(`https://orangecat.ch/api/v1/pay/product/${ENTITY_ID}`), {
      params,
    });
    expect(res.status).toBe(400);
    expect(mockCreateChallenge).not.toHaveBeenCalled();
  });

  it('returns the receipt when the L402 proof verifies', async () => {
    mockVerify.mockResolvedValue({
      ok: true,
      verified_by: 'preimage',
      status: 'paid',
      paid_at: '2026-08-02T12:00:00Z',
    });
    const res = await GET(
      makeRequest(`https://orangecat.ch/api/v1/pay/product/${ENTITY_ID}`, {
        authorization: `L402 ${ENTITY_ID}.tok:${'a'.repeat(64)}`,
      }),
      { params }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.verified_by).toBe('preimage');
    expect(body.data.status).toBe('paid');
    expect(mockCreateChallenge).not.toHaveBeenCalled();
    // The route must hand the URL's entity to the verifier — that's what binds
    // the receipt to the resource being paid for.
    expect(mockVerify).toHaveBeenCalledWith(expect.anything(), {
      entityType: 'product',
      entityId: ENTITY_ID,
    });
  });

  it('answers 402 again (no new intent) when the invoice is still unpaid', async () => {
    mockVerify.mockResolvedValue({ ok: false, status: 'invoice_ready', paid_at: null });
    const res = await GET(
      makeRequest(`https://orangecat.ch/api/v1/pay/product/${ENTITY_ID}`, {
        authorization: `L402 ${ENTITY_ID}.tok:${'b'.repeat(64)}`,
      }),
      { params }
    );
    expect(res.status).toBe(402);
    expect(mockCreateChallenge).not.toHaveBeenCalled();
  });

  it('maps an unknown token to 404', async () => {
    mockVerify.mockRejectedValue(new Error('Payment not found'));
    const res = await GET(
      makeRequest(`https://orangecat.ch/api/v1/pay/product/${ENTITY_ID}`, {
        authorization: `L402 ${ENTITY_ID}.tok:${'c'.repeat(64)}`,
      }),
      { params }
    );
    expect(res.status).toBe(404);
  });

  it('maps domain safe-errors to 400 without leaking internals', async () => {
    mockCreateChallenge.mockRejectedValue(
      new Error('Seller has no wallet connected. Payment not available.')
    );
    const res = await GET(
      makeRequest(`https://orangecat.ch/api/v1/pay/product/${ENTITY_ID}?amount_btc=0.0001`),
      { params }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('has not connected a Bitcoin wallet');
  });
});

/**
 * Finding 1 of bitbaum/orangecat#563: every challenge mints a REAL invoice
 * through the recipient's own LNURL/NWC relay. A per-IP limit does not protect
 * the seller from an attacker who rotates addresses — the victim's wallet
 * provider is what gets hammered, and it is the victim who gets banned.
 */
describe('per-recipient invoice-spam limit', () => {
  beforeEach(() => {
    (rateLimitPaymentRecipient as Mock).mockResolvedValue({ success: true });
  });

  it('keys the limit on the recipient, not only the caller', async () => {
    await GET(makeRequest('https://x.test/api/v1/pay/product/' + ENTITY_ID), { params });
    expect(rateLimitPaymentRecipient).toHaveBeenCalledWith('product', ENTITY_ID);
  });

  it('refuses with 429 when that recipient is already being hammered', async () => {
    (rateLimitPaymentRecipient as Mock).mockResolvedValue({ success: false });
    const res = await GET(makeRequest('https://x.test/api/v1/pay/product/' + ENTITY_ID), {
      params,
    });
    expect(res.status).toBe(429);
  });
});

/**
 * The verify branch deliberately sits OUTSIDE the per-IP challenge budget: a
 * payer who has genuinely paid must be able to retry until settlement is seen,
 * and making them share the challenge budget would lock them out of their own
 * purchase.
 *
 * But unbounded is not the same as unbudgeted. Every check on a non-terminal
 * intent drives an outbound call to the recipient's LNURL/NWC relay or to
 * mempool, so a single valid token bought unlimited traffic aimed at someone
 * else's infrastructure — and the per-IP limiter could not see it, by design.
 *
 * bitbaum/orangecat#563 finding 7.
 */
describe('L402 verify-retry limit', () => {
  const AUTH = { authorization: `L402 ${ENTITY_ID}.tok_abc:${'a'.repeat(64)}` };

  beforeEach(() => {
    (rateLimitL402Verify as Mock).mockResolvedValue({ success: true });
    (rateLimitWriteAsync as Mock).mockResolvedValue({ success: true });
    mockVerify.mockResolvedValue({ ok: false, status: 'pending' });
  });

  it('keys the budget on the payment intent, which a caller cannot rotate', async () => {
    await GET(makeRequest('https://x.test/api/v1/pay/product/' + ENTITY_ID, AUTH), { params });
    expect(rateLimitL402Verify).toHaveBeenCalledWith(ENTITY_ID);
  });

  it('refuses with 429 once one token has hammered the relay', async () => {
    (rateLimitL402Verify as Mock).mockResolvedValue({ success: false });
    const res = await GET(makeRequest('https://x.test/api/v1/pay/product/' + ENTITY_ID, AUTH), {
      params,
    });
    expect(res.status).toBe(429);
    // Refused BEFORE the outbound check — the whole point is not making it.
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('still does not spend the challenge budget on a verify', async () => {
    await GET(makeRequest('https://x.test/api/v1/pay/product/' + ENTITY_ID, AUTH), { params });
    expect(rateLimitWriteAsync).not.toHaveBeenCalled();
    expect(rateLimitPaymentRecipient).not.toHaveBeenCalled();
  });

  it('leaves the challenge branch on the per-IP budget, not the verify one', async () => {
    mockCreateChallenge.mockResolvedValue({
      header: 'L402 token="i.t", invoice="lnbc1"',
      payment_intent_id: 'i',
      status_token: 't',
    });
    await GET(makeRequest('https://x.test/api/v1/pay/product/' + ENTITY_ID), { params });
    expect(rateLimitL402Verify).not.toHaveBeenCalled();
    expect(rateLimitWriteAsync).toHaveBeenCalled();
  });
});
