/**
 * standardResponse Contract Tests
 *
 * These tests verify the exact envelope shape produced by apiSuccess and
 * apiError helpers WITHOUT mocking them. They exist to catch the class of
 * bug where client code reads `body.field` instead of `body.data.field`.
 *
 * 16 such bugs were found and fixed across 13 files (April 2026).
 * This suite is the regression guard that makes them impossible to reintroduce
 * silently — any change to the envelope shape breaks these tests.
 *
 * Contract:
 *   apiSuccess(payload)  → { success: true, data: payload, metadata: { timestamp, ... } }
 *   apiError(msg, code)  → { success: false, error: { code, message }, metadata: { timestamp } }
 */

// Provide a real-ish NextResponse.json so the helpers produce parseable objects.
// The global __mocks__/next-server.js mock returns vi.fn() (→ undefined), which
// prevents calling .json() on the result. Override it here with an implementation.
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit & { headers?: HeadersInit }) => {
      const headerMap = new Headers(init?.headers);
      return {
        status: (init as { status?: number })?.status ?? 200,
        headers: headerMap,
        json: async () => data,
      };
    },
    redirect: vi.fn(),
    next: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  apiPaymentRequired,
  apiSuccess,
  apiError,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiConflict,
  apiValidationError,
  apiRateLimited,
  apiInternalError,
  apiServiceUnavailable,
} from '@/lib/api/standardResponse';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function json(response: { json: () => Promise<unknown> }) {
  return response.json();
}

// ---------------------------------------------------------------------------
// apiSuccess
// ---------------------------------------------------------------------------

describe('apiSuccess — envelope contract', () => {
  it('wraps payload in { success, data, metadata }', async () => {
    const payload = { id: 'abc', title: 'Hello' };
    const response = apiSuccess(payload);
    const body = (await json(response)) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.data).toEqual(payload);
    expect((body.metadata as Record<string, unknown>)?.timestamp).toBeDefined();
  });

  it('does NOT hoist payload fields to the top level', async () => {
    // This is the bug that was fixed 16 times:
    // client code accessed body.message / body.wallet / body.updates
    // instead of body.data.message / body.data.wallet / body.data.updates
    const payload = {
      message: 'AI response',
      wallet: { id: 'w1', balance_btc: 0.001 },
      updates: [{ id: 'u1' }],
      isFavorited: true,
      upload_url: 'https://example.com/upload',
    };
    const response = apiSuccess(payload);
    const body = (await json(response)) as Record<string, unknown>;

    // Fields must NOT be accessible at the top level
    expect(body.message).toBeUndefined();
    expect(body.wallet).toBeUndefined();
    expect(body.updates).toBeUndefined();
    expect(body.isFavorited).toBeUndefined();
    expect(body.upload_url).toBeUndefined();

    // Fields ARE accessible under .data
    const data = body.data as typeof payload;
    expect(data.message).toBe('AI response');
    expect(data.wallet).toEqual({ id: 'w1', balance_btc: 0.001 });
    expect(data.updates).toEqual([{ id: 'u1' }]);
    expect(data.isFavorited).toBe(true);
    expect(data.upload_url).toBe('https://example.com/upload');
  });

  it('uses status 200 by default', async () => {
    const response = apiSuccess({ ok: true });
    expect((response as unknown as { status: number }).status).toBe(200);
  });

  it('accepts a custom status code', async () => {
    const response = apiSuccess({ id: 'new' }, { status: 201 });
    expect((response as unknown as { status: number }).status).toBe(201);
  });

  it('includes pagination in metadata when provided', async () => {
    const response = apiSuccess([1, 2, 3], { page: 2, limit: 10, total: 50 });
    const body = (await json(response)) as Record<string, unknown>;
    const meta = body.metadata as Record<string, unknown>;

    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(10);
    expect(meta.total).toBe(50);
  });

  it('metadata.timestamp is an ISO 8601 string', async () => {
    const before = new Date().toISOString();
    const response = apiSuccess({ x: 1 });
    const body = (await json(response)) as Record<string, unknown>;
    const after = new Date().toISOString();

    const ts = (body.metadata as Record<string, unknown>)?.timestamp as string;
    expect(ts >= before).toBe(true);
    expect(ts <= after).toBe(true);
  });

  it('passes arrays as data', async () => {
    const items = [{ id: '1' }, { id: '2' }];
    const response = apiSuccess(items);
    const body = (await json(response)) as Record<string, unknown>;

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toEqual(items);
  });

  it('passes null as data', async () => {
    const response = apiSuccess(null);
    const body = (await json(response)) as Record<string, unknown>;
    expect(body.data).toBeNull();
  });

  it('sets Cache-Control header when cache option is provided', async () => {
    // Pass the literal value (key-based lookup is unreachable since all keys are strings)
    const response = apiSuccess({ x: 1 }, { cache: 'no-store, must-revalidate' });
    const headers = (response as unknown as { headers: Headers }).headers;
    expect(headers.get('Cache-Control')).toBe('no-store, must-revalidate');
  });
});

// ---------------------------------------------------------------------------
// apiError and error helpers
// ---------------------------------------------------------------------------

describe('apiError — envelope contract', () => {
  it('wraps error in { success: false, error: { code, message } }', async () => {
    const response = apiError('Something went wrong', 'CUSTOM_CODE', 500);
    const body = (await json(response)) as Record<string, unknown>;

    expect(body.success).toBe(false);
    const err = body.error as Record<string, unknown>;
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.message).toBe('Something went wrong');
    expect((body.metadata as Record<string, unknown>)?.timestamp).toBeDefined();
  });

  it('includes details when provided', async () => {
    const details = { field: 'email', reason: 'invalid' };
    const response = apiError('Validation failed', 'VALIDATION_ERROR', 422, details);
    const body = (await json(response)) as Record<string, unknown>;
    const err = body.error as Record<string, unknown>;
    expect(err.details).toEqual(details);
  });
});

describe('error helper codes and statuses', () => {
  const cases: Array<
    [string, () => { status: number; json: () => Promise<unknown> }, number, string]
  > = [
    ['apiBadRequest', () => apiBadRequest('bad'), 400, 'BAD_REQUEST'],
    ['apiUnauthorized', () => apiUnauthorized(), 401, 'UNAUTHORIZED'],
    ['apiForbidden', () => apiForbidden(), 403, 'FORBIDDEN'],
    ['apiNotFound', () => apiNotFound(), 404, 'NOT_FOUND'],
    ['apiConflict', () => apiConflict(), 409, 'CONFLICT'],
    ['apiValidationError', () => apiValidationError(), 422, 'VALIDATION_ERROR'],
    ['apiRateLimited', () => apiRateLimited(), 429, 'RATE_LIMITED'],
    ['apiInternalError', () => apiInternalError(), 500, 'INTERNAL_ERROR'],
    ['apiServiceUnavailable', () => apiServiceUnavailable(), 503, 'SERVICE_UNAVAILABLE'],
  ];

  it.each(cases)(
    '%s returns correct status and code',
    async (name, fn, expectedStatus, expectedCode) => {
      const response = fn();
      expect((response as unknown as { status: number }).status).toBe(expectedStatus);
      const body = (await json(response)) as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect((body.error as Record<string, unknown>).code).toBe(expectedCode);
    }
  );
});

describe('apiRateLimited — Retry-After header', () => {
  it('sets Retry-After header when retryAfter is provided', async () => {
    const response = apiRateLimited('Too fast', 30);
    const headers = (response as unknown as { headers: Headers }).headers;
    expect(headers.get('Retry-After')).toBe('30');
  });

  it('omits Retry-After header when retryAfter is not provided', async () => {
    const response = apiRateLimited('Too fast');
    const headers = (response as unknown as { headers: Headers }).headers;
    expect(headers.get('Retry-After')).toBeNull();
  });
});

/**
 * A 402 carries a bearer credential, so it must never be cached.
 *
 * The body embeds `token` (`<intentId>.<statusToken>`) and WWW-Authenticate
 * repeats it — that token is what a payer later exchanges for a receipt. So
 * anything caching this response caches a credential for someone else's
 * payment. Every other payment response sets no-store; this one did not.
 * bitbaum/orangecat#563 suggestion 15.
 */
describe('apiPaymentRequired — never cached', () => {
  const headersOf = (r: unknown) => (r as { headers: Headers }).headers;

  it('sets no-store', () => {
    expect(
      headersOf(apiPaymentRequired('Pay up', { token: 'pi-1.tok' })).get('Cache-Control')
    ).toBe('no-store, must-revalidate');
  });

  it('sets it on the challenge form, where the header repeats the token', () => {
    const res = apiPaymentRequired('Pay up', { token: 'pi-1.tok' }, 'L402 token="pi-1.tok"');
    expect(headersOf(res).get('Cache-Control')).toBe('no-store, must-revalidate');
    expect(headersOf(res).get('WWW-Authenticate')).toContain('L402');
  });
});
