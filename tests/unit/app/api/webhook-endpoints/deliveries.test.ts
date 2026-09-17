/**
 * Webhook deliveries routes — handler-level branch tests.
 *
 * Covers the two operator-facing routes shipped without tests:
 *   - GET  /api/webhook-endpoints/[id]/deliveries        (246216a4)
 *   - POST /api/webhook-endpoints/[id]/deliveries/[deliveryId]/replay (bfd39b6d)
 *
 * Both share the userOwnsEndpoint gate; the replay route adds a
 * deliveryBelongsToEndpoint check on top. We mock the services so
 * the handler logic is the only thing under test.
 *
 * Created: 2026-06-04
 */

// Mocked so importing the route doesn't pull the real Upstash client (ESM-only
// dep jest can't parse). Within-quota by default; branch tests set overrides.
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi
    .fn()
    .mockResolvedValue({ success: true, limit: 30, remaining: 29, resetTime: Date.now() + 60_000 }),
  retryAfterSeconds: vi.fn(() => 1),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/services/webhooks/webhookEndpointsService', () => ({
  userOwnsEndpoint: vi.fn(),
}));

vi.mock('@/services/webhooks/deliveryService', () => ({
  listRecentDeliveriesForEndpoint: vi.fn(),
  deliveryBelongsToEndpoint: vi.fn(),
  enqueueDeliveryReplay: vi.fn(),
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((payload: unknown) => ({ ok: true, data: payload, status: 200 })),
  apiUnauthorized: vi.fn(() => ({ ok: false, error: 'Unauthorized', status: 401 })),
  apiNotFound: vi.fn((what: string) => ({ ok: false, error: `${what} not found`, status: 404 })),
  apiError: vi.fn((msg: string, code: string, status: number) => ({
    ok: false,
    error: msg,
    code,
    status,
  })),
  handleApiError: vi.fn((err: Error) => ({ ok: false, error: err.message, status: 500 })),
}));

import { GET } from '@/app/api/webhook-endpoints/[id]/deliveries/route';
import { POST as REPLAY_POST } from '@/app/api/webhook-endpoints/[id]/deliveries/[deliveryId]/replay/route';
import { createServerClient } from '@/lib/supabase/server';
import { userOwnsEndpoint } from '@/services/webhooks/webhookEndpointsService';
import {
  listRecentDeliveriesForEndpoint,
  deliveryBelongsToEndpoint,
  enqueueDeliveryReplay,
} from '@/services/webhooks/deliveryService';
import { apiSuccess, apiUnauthorized, apiNotFound, apiError } from '@/lib/api/standardResponse';

import type { Mock } from 'vitest';

const mockUser = { id: 'u-1' };

function setSession(user: { id: string } | null) {
  (createServerClient as Mock).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  });
}

// Handlers only read `.url`. jsdom doesn't expose the global Request
// constructor, so a minimal shim keeps the tests env-independent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRequest(url: string): any {
  return { url };
}

function withParams<T extends Record<string, string>>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// GET /api/webhook-endpoints/[id]/deliveries
// =============================================================================

describe('GET /api/webhook-endpoints/[id]/deliveries', () => {
  it('returns 401 when no session user', async () => {
    setSession(null);

    const res = (await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries'),
      withParams({ id: 'e-1' })
    )) as { status: number };

    expect(res.status).toBe(401);
    expect(apiUnauthorized).toHaveBeenCalled();
  });

  it('returns 404 when the user does not own the endpoint', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(false);

    const res = (await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries'),
      withParams({ id: 'e-1' })
    )) as { status: number };

    expect(res.status).toBe(404);
    expect(apiNotFound).toHaveBeenCalledWith('Webhook endpoint');
    expect(listRecentDeliveriesForEndpoint).not.toHaveBeenCalled();
  });

  it('returns deliveries on success and caps at default limit (50)', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    const rows = [{ id: 'd-1' }, { id: 'd-2' }];
    (listRecentDeliveriesForEndpoint as Mock).mockResolvedValue(rows);

    const res = (await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries'),
      withParams({ id: 'e-1' })
    )) as { ok: boolean; data: { deliveries: Array<{ id: string }> } };

    expect(res.ok).toBe(true);
    expect(res.data.deliveries).toBe(rows);
    expect(listRecentDeliveriesForEndpoint).toHaveBeenCalledWith('e-1', 50);
    expect(apiSuccess).toHaveBeenCalledWith({ deliveries: rows });
  });

  it('honours ?limit= up to MAX (100)', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    (listRecentDeliveriesForEndpoint as Mock).mockResolvedValue([]);

    await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries?limit=25'),
      withParams({ id: 'e-1' })
    );
    expect(listRecentDeliveriesForEndpoint).toHaveBeenCalledWith('e-1', 25);
  });

  it('caps ?limit= at MAX (100) when the caller asks for more', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    (listRecentDeliveriesForEndpoint as Mock).mockResolvedValue([]);

    await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries?limit=999'),
      withParams({ id: 'e-1' })
    );
    expect(listRecentDeliveriesForEndpoint).toHaveBeenCalledWith('e-1', 100);
  });

  it('falls back to DEFAULT when ?limit= is non-numeric or <=0', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    (listRecentDeliveriesForEndpoint as Mock).mockResolvedValue([]);

    await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries?limit=abc'),
      withParams({ id: 'e-1' })
    );
    expect(listRecentDeliveriesForEndpoint).toHaveBeenLastCalledWith('e-1', 50);

    await GET(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries?limit=0'),
      withParams({ id: 'e-1' })
    );
    expect(listRecentDeliveriesForEndpoint).toHaveBeenLastCalledWith('e-1', 50);
  });
});

// =============================================================================
// POST /api/webhook-endpoints/[id]/deliveries/[deliveryId]/replay
// =============================================================================

describe('POST /api/webhook-endpoints/[id]/deliveries/[deliveryId]/replay', () => {
  it('returns 401 when no session user', async () => {
    setSession(null);

    const res = (await REPLAY_POST(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries/d-1/replay'),
      withParams({ id: 'e-1', deliveryId: 'd-1' })
    )) as { status: number };

    expect(res.status).toBe(401);
    expect(userOwnsEndpoint).not.toHaveBeenCalled();
    expect(deliveryBelongsToEndpoint).not.toHaveBeenCalled();
    expect(enqueueDeliveryReplay).not.toHaveBeenCalled();
  });

  it('returns 404 (Webhook endpoint) when the user does not own the endpoint', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(false);

    const res = (await REPLAY_POST(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries/d-1/replay'),
      withParams({ id: 'e-1', deliveryId: 'd-1' })
    )) as { status: number };

    expect(res.status).toBe(404);
    expect(apiNotFound).toHaveBeenCalledWith('Webhook endpoint');
    expect(deliveryBelongsToEndpoint).not.toHaveBeenCalled();
    expect(enqueueDeliveryReplay).not.toHaveBeenCalled();
  });

  it('returns 404 (Webhook delivery) when delivery does not belong to endpoint', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    (deliveryBelongsToEndpoint as Mock).mockResolvedValue(false);

    const res = (await REPLAY_POST(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries/d-1/replay'),
      withParams({ id: 'e-1', deliveryId: 'd-1' })
    )) as { status: number };

    expect(res.status).toBe(404);
    // Both 404s use the same generic envelope so probers can't distinguish
    // endpoint-mismatch from delivery-mismatch.
    expect(apiNotFound).toHaveBeenCalledWith('Webhook delivery');
    expect(enqueueDeliveryReplay).not.toHaveBeenCalled();
  });

  it('returns 500 when the enqueue service signals failure', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    (deliveryBelongsToEndpoint as Mock).mockResolvedValue(true);
    (enqueueDeliveryReplay as Mock).mockResolvedValue(false);

    const res = (await REPLAY_POST(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries/d-1/replay'),
      withParams({ id: 'e-1', deliveryId: 'd-1' })
    )) as { status: number };

    expect(res.status).toBe(500);
    expect(apiError).toHaveBeenCalledWith('Replay failed', 'INTERNAL_ERROR', 500);
  });

  it('returns 200 with replayed:true on the happy path', async () => {
    setSession(mockUser);
    (userOwnsEndpoint as Mock).mockResolvedValue(true);
    (deliveryBelongsToEndpoint as Mock).mockResolvedValue(true);
    (enqueueDeliveryReplay as Mock).mockResolvedValue(true);

    const res = (await REPLAY_POST(
      makeRequest('http://x/api/webhook-endpoints/e-1/deliveries/d-1/replay'),
      withParams({ id: 'e-1', deliveryId: 'd-1' })
    )) as { ok: boolean; data: { replayed: boolean } };

    expect(res.ok).toBe(true);
    expect(apiSuccess).toHaveBeenCalledWith({ replayed: true });
    expect(enqueueDeliveryReplay).toHaveBeenCalledWith('d-1');
  });
});
