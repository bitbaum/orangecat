/**
 * GET /api/cron/webhook-worker — handler-level branch tests.
 *
 * A systemd timer runs this every minute. Silent failures in processDelivery
 * drop deliveries on the floor; customers see "0 deliveries" with no
 * signal, and OrangeCat operators don't notice until a customer complains.
 *
 * The worker is the most-state-touching route on the platform: claim
 * (atomic), signing-context fetch, sign, fetch the customer URL, branch
 * on response status, log + mark + bump for retry. Each branch matters.
 *
 * Created: 2026-06-04
 */

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/webhooks/deliveryService', () => ({
  pickDueDeliveries: vi.fn(),
  claimDelivery: vi.fn(),
  markDelivered: vi.fn(),
  markFailedOrRetry: vi.fn(),
}));

vi.mock('@/services/webhooks/webhookEndpointsService', () => ({
  getEndpointSigningContext: vi.fn(),
  touchEndpointLastDelivery: vi.fn(),
}));

vi.mock('@/services/webhooks/signing', () => ({
  signWebhookPayload: vi.fn(() => 't=1700000000,v1=stub'),
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((payload: unknown) => ({ ok: true, data: payload, status: 200 })),
  apiError: vi.fn((msg: string, code: string, status: number) => ({
    ok: false,
    error: msg,
    code,
    status,
  })),
  apiUnauthorized: vi.fn(() => ({ ok: false, error: 'Unauthorized', status: 401 })),
}));

import { GET } from '@/app/api/cron/webhook-worker/route';
import {
  pickDueDeliveries,
  claimDelivery,
  markDelivered,
  markFailedOrRetry,
} from '@/services/webhooks/deliveryService';
import {
  getEndpointSigningContext,
  touchEndpointLastDelivery,
} from '@/services/webhooks/webhookEndpointsService';
import { signWebhookPayload } from '@/services/webhooks/signing';
import { apiSuccess, apiUnauthorized } from '@/lib/api/standardResponse';

import type { Mock } from 'vitest';

const CRON_SECRET = 'test-cron-secret';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRequest(authHeader: string | null): any {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : null),
    },
  };
}

function makeDelivery(overrides: Partial<{ id: string; attempt_count: number }> = {}) {
  return {
    id: 'd-1',
    endpoint_id: 'e-1',
    event_type: 'product.created',
    event_id: 'evt-1',
    payload: { hello: 'world' },
    status: 'pending' as const,
    response_status: null,
    response_body: null,
    attempt_count: 0,
    last_attempt_at: null,
    next_attempt_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const goodCtx = {
  url: 'https://recv.example/hook',
  secret: 'ock_whk_test_secret_value',
  actorId: 'a-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  // Default to "auth + empty batch" so tests opt into delivery rows.
  (pickDueDeliveries as Mock).mockResolvedValue([]);
  (claimDelivery as Mock).mockResolvedValue(true);
  (getEndpointSigningContext as Mock).mockResolvedValue(goodCtx);
  (markDelivered as Mock).mockResolvedValue(undefined);
  (markFailedOrRetry as Mock).mockResolvedValue(undefined);
  // Default global fetch — tests override per case.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = vi.fn();
});

afterAll(() => {
  delete process.env.CRON_SECRET;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (global as any).fetch;
});

// =============================================================================
// Auth
// =============================================================================

describe('GET /api/cron/webhook-worker — auth', () => {
  it('returns 401 when no authorization header', async () => {
    const res = (await GET(makeRequest(null))) as { status: number };
    expect(res.status).toBe(401);
    expect(apiUnauthorized).toHaveBeenCalled();
    expect(pickDueDeliveries).not.toHaveBeenCalled();
  });

  it('returns 401 when secret does not match', async () => {
    const res = (await GET(makeRequest('Bearer wrong'))) as { status: number };
    expect(res.status).toBe(401);
    expect(pickDueDeliveries).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Empty batch
// =============================================================================

describe('GET /api/cron/webhook-worker — empty batch', () => {
  it('returns processed:0 when nothing is due', async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([]);

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      ok: boolean;
      data: { processed: number; ranAt: string };
    };

    expect(res.ok).toBe(true);
    expect(res.data.processed).toBe(0);
    expect(typeof res.data.ranAt).toBe('string');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(claimDelivery).not.toHaveBeenCalled();
  });
});

// =============================================================================
// processDelivery branches — each delivery row exercises one branch.
// =============================================================================

describe('GET /api/cron/webhook-worker — processDelivery branches', () => {
  it('skipped: claim returns false → no further work, summary.skipped++', async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery()]);
    (claimDelivery as Mock).mockResolvedValue(false);

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { processed: number; summary: Record<string, number> };
    };

    expect(res.data.processed).toBe(1);
    expect(res.data.summary).toEqual({ delivered: 0, retry: 0, failed: 0, skipped: 1 });
    expect(getEndpointSigningContext).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(markDelivered).not.toHaveBeenCalled();
    expect(markFailedOrRetry).not.toHaveBeenCalled();
  });

  it("delivered (revoked): signing context is null → markDelivered(0, '[endpoint revoked]')", async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery()]);
    (getEndpointSigningContext as Mock).mockResolvedValue(null);

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { summary: Record<string, number> };
    };

    expect(res.data.summary.delivered).toBe(1);
    expect(markDelivered).toHaveBeenCalledWith('d-1', 0, '[endpoint revoked]');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(touchEndpointLastDelivery).not.toHaveBeenCalled();
  });

  it('delivered (2xx): POSTs with signature + headers, markDelivered, touchEndpoint fires', async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery()]);
    (global.fetch as Mock).mockResolvedValue({
      status: 204,
      text: () => Promise.resolve(''),
    });

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { summary: Record<string, number> };
    };

    expect(res.data.summary.delivered).toBe(1);
    expect(signWebhookPayload).toHaveBeenCalledWith(
      JSON.stringify({ hello: 'world' }),
      goodCtx.secret
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (global.fetch as Mock).mock.calls[0];
    expect(calledUrl).toBe(goodCtx.url);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-OrangeCat-Signature']).toBe('t=1700000000,v1=stub');
    expect(init.headers['X-OrangeCat-Event-Id']).toBe('evt-1');
    expect(init.headers['X-OrangeCat-Event-Type']).toBe('product.created');

    expect(markDelivered).toHaveBeenCalledWith('d-1', 204, '');
    expect(touchEndpointLastDelivery).toHaveBeenCalledWith('e-1');
    expect(markFailedOrRetry).not.toHaveBeenCalled();
  });

  it('retry (non-2xx, under MAX): markFailedOrRetry with response status + body', async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery({ attempt_count: 2 })]);
    (global.fetch as Mock).mockResolvedValue({
      status: 503,
      text: () => Promise.resolve('try again'),
    });

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { summary: Record<string, number> };
    };

    expect(res.data.summary.retry).toBe(1);
    expect(markFailedOrRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd-1', attempt_count: 3 }), // claim bumped
      503,
      'try again'
    );
    expect(markDelivered).not.toHaveBeenCalled();
  });

  it('failed (non-2xx, after MAX attempts): summary.failed++ instead of retry', async () => {
    // attempt_count starts at 6 → claim bumps to 7 → 7 > 6 → outcome 'failed'
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery({ attempt_count: 6 })]);
    (global.fetch as Mock).mockResolvedValue({
      status: 500,
      text: () => Promise.resolve(''),
    });

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { summary: Record<string, number> };
    };

    expect(res.data.summary.failed).toBe(1);
    expect(res.data.summary.retry).toBe(0);
    expect(markFailedOrRetry).toHaveBeenCalled();
  });

  it("retry (network error): markFailedOrRetry(null, '[network] <msg>'), null responseStatus", async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery({ attempt_count: 2 })]);
    (global.fetch as Mock).mockRejectedValue(new Error('ECONNRESET'));

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { summary: Record<string, number> };
    };

    expect(res.data.summary.retry).toBe(1);
    expect(markFailedOrRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_count: 3 }),
      null,
      '[network] ECONNRESET'
    );
  });

  it("retry (non-Error network rejection): markFailedOrRetry with '[network] unknown'", async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([makeDelivery()]);
    (global.fetch as Mock).mockRejectedValue('weird');

    await GET(makeRequest(`Bearer ${CRON_SECRET}`));

    expect(markFailedOrRetry).toHaveBeenCalledWith(expect.anything(), null, '[network] unknown');
  });
});

// =============================================================================
// Top-level error path
// =============================================================================

describe('GET /api/cron/webhook-worker — top-level error', () => {
  it('returns 500 INTERNAL_ERROR when pickDueDeliveries throws', async () => {
    (pickDueDeliveries as Mock).mockRejectedValue(new Error('db gone'));

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as { status: number };
    expect(res.status).toBe(500);
  });
});

// =============================================================================
// Batch summary across multiple deliveries
// =============================================================================

describe('GET /api/cron/webhook-worker — batch summary', () => {
  it('aggregates outcomes across deliveries in one batch', async () => {
    (pickDueDeliveries as Mock).mockResolvedValue([
      makeDelivery({ id: 'd-1' }),
      makeDelivery({ id: 'd-2' }),
      makeDelivery({ id: 'd-3' }),
    ]);
    (claimDelivery as Mock)
      .mockResolvedValueOnce(true) // d-1 claims
      .mockResolvedValueOnce(false) // d-2 skipped
      .mockResolvedValueOnce(true); // d-3 claims
    (global.fetch as Mock)
      .mockResolvedValueOnce({ status: 200, text: () => Promise.resolve('ok') }) // d-1 delivered
      .mockResolvedValueOnce({ status: 500, text: () => Promise.resolve('bad') }); // d-3 retry

    const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
      data: { processed: number; summary: Record<string, number> };
    };

    expect(res.data.processed).toBe(3);
    expect(res.data.summary).toEqual({ delivered: 1, retry: 1, failed: 0, skipped: 1 });
    // apiSuccess includes the ranAt timestamp from the wrapping success payload.
    expect(apiSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        processed: 3,
        summary: { delivered: 1, retry: 1, failed: 0, skipped: 1 },
      })
    );
  });
});
