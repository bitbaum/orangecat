/**
 * Webhook endpoints CRUD routes — handler-level branch tests.
 *
 * Covers the three operator-facing routes shipped without handler-level
 * coverage:
 *   - GET    /api/webhook-endpoints       (211188a3 — list)
 *   - POST   /api/webhook-endpoints       (211188a3 — mint, returns secret once)
 *   - DELETE /api/webhook-endpoints/[id]  (211188a3 — revoke)
 *
 * Same admin-mock + per-route-import pattern as bdef16f4 + 38d8282d.
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

vi.mock('@/services/webhooks/webhookEndpointsService', () => {
  class ActorNotPermittedError extends Error {}
  return {
    createWebhookEndpoint: vi.fn(),
    listWebhookEndpoints: vi.fn(),
    revokeWebhookEndpoint: vi.fn(),
    ActorNotPermittedError,
  };
});

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((payload: unknown, opts?: { status?: number }) => ({
    ok: true,
    data: payload,
    status: opts?.status ?? 200,
  })),
  apiUnauthorized: vi.fn(() => ({ ok: false, error: 'Unauthorized', status: 401 })),
  apiForbidden: vi.fn((msg: string) => ({ ok: false, error: msg, status: 403 })),
  apiNotFound: vi.fn((what: string) => ({ ok: false, error: `${what} not found`, status: 404 })),
  apiValidationError: vi.fn((msg: string, details: unknown) => ({
    ok: false,
    error: msg,
    details,
    status: 400,
  })),
  handleApiError: vi.fn((err: Error) => ({ ok: false, error: err.message, status: 500 })),
}));

import { GET, POST } from '@/app/api/webhook-endpoints/route';
import { DELETE } from '@/app/api/webhook-endpoints/[id]/route';
import { createServerClient } from '@/lib/supabase/server';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  revokeWebhookEndpoint,
  ActorNotPermittedError,
} from '@/services/webhooks/webhookEndpointsService';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiValidationError,
  handleApiError,
} from '@/lib/api/standardResponse';

import type { Mock } from 'vitest';

const mockUser = { id: 'u-1' };

function setSession(user: { id: string } | null) {
  (createServerClient as Mock).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  });
}

// The compose chain calls req.json() (via withZodBody) and the
// handler reads `.url` on the GET deliveries-list shim only — this
// route's handlers don't read url, so a minimal {json} suffices.
interface MockReq {
  json: () => Promise<unknown>;
  url?: string;
  headers?: { get: (n: string) => string | null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRequest(body?: unknown): any {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: 'http://x/api/webhook-endpoints',
    headers: { get: () => null },
  } satisfies MockReq;
}

function withParams<T extends Record<string, string>>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// GET /api/webhook-endpoints
// =============================================================================

describe('GET /api/webhook-endpoints', () => {
  it('returns 401 when no session user', async () => {
    setSession(null);

    const res = (await GET(makeRequest(), {})) as { status: number };

    expect(res.status).toBe(401);
    expect(apiUnauthorized).toHaveBeenCalled();
    expect(listWebhookEndpoints).not.toHaveBeenCalled();
  });

  it('returns endpoints for the session user', async () => {
    setSession(mockUser);
    const endpoints = [{ id: 'e-1' }, { id: 'e-2' }];
    (listWebhookEndpoints as Mock).mockResolvedValue(endpoints);

    const res = (await GET(makeRequest(), {})) as {
      ok: boolean;
      data: { endpoints: Array<{ id: string }> };
    };

    expect(res.ok).toBe(true);
    expect(res.data.endpoints).toBe(endpoints);
    expect(listWebhookEndpoints).toHaveBeenCalledWith(mockUser.id);
  });

  it('falls through to handleApiError when the service throws', async () => {
    setSession(mockUser);
    (listWebhookEndpoints as Mock).mockRejectedValue(new Error('boom'));

    const res = (await GET(makeRequest(), {})) as { status: number };

    expect(res.status).toBe(500);
    expect(handleApiError).toHaveBeenCalled();
  });
});

// =============================================================================
// POST /api/webhook-endpoints
// =============================================================================

const validBody = {
  name: 'Loki subs',
  url: 'https://loki.app/webhooks/orangecat',
  actor_id: '00000000-0000-0000-0000-000000000001',
};

describe('POST /api/webhook-endpoints', () => {
  it('returns 400 (validation_error) when the body fails Zod', async () => {
    setSession(mockUser);

    const res = (await POST(makeRequest({ name: '', url: 'not-a-url' }), {})) as { status: number };

    expect(res.status).toBe(400);
    expect(apiValidationError).toHaveBeenCalled();
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it('returns 401 when no session user', async () => {
    setSession(null);

    const res = (await POST(makeRequest(validBody), {})) as { status: number };

    expect(res.status).toBe(401);
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it('rejects http:// URLs in production with 403', async () => {
    setSession(mockUser);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = (await POST(
        makeRequest({ ...validBody, url: 'http://insecure.example/hook' }),
        {}
      )) as { status: number };

      expect(res.status).toBe(403);
      expect(apiForbidden).toHaveBeenCalledWith('Webhook URL must use https in production.');
      expect(createWebhookEndpoint).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('allows http:// URLs in development (localhost testing)', async () => {
    setSession(mockUser);
    // NODE_ENV is 'test' in jest by default — same code path as 'development'.
    (createWebhookEndpoint as Mock).mockResolvedValue({
      endpoint: { id: 'e-1', secret_prefix: 'ock_whk_abc' },
      secret: 'ock_whk_full',
    });

    const res = (await POST(makeRequest({ ...validBody, url: 'http://localhost:3000/h' }), {})) as {
      status: number;
    };

    expect(res.status).toBe(201);
    expect(createWebhookEndpoint).toHaveBeenCalled();
  });

  it('returns 403 on ActorNotPermittedError with the canonical message', async () => {
    setSession(mockUser);
    (createWebhookEndpoint as Mock).mockRejectedValue(
      new ActorNotPermittedError('not a group member')
    );

    const res = (await POST(makeRequest(validBody), {})) as { status: number };

    expect(res.status).toBe(403);
    expect(apiForbidden).toHaveBeenCalledWith(
      'You are not permitted to create an endpoint for this actor.'
    );
    expect(handleApiError).not.toHaveBeenCalled();
  });

  it('falls through to handleApiError on unknown service exception', async () => {
    setSession(mockUser);
    (createWebhookEndpoint as Mock).mockRejectedValue(new Error('connection_reset'));

    const res = (await POST(makeRequest(validBody), {})) as { status: number };

    expect(res.status).toBe(500);
    expect(handleApiError).toHaveBeenCalled();
  });

  it('returns 201 with endpoint + secret on success', async () => {
    setSession(mockUser);
    const minted = {
      endpoint: { id: 'e-1', secret_prefix: 'ock_whk_abc' },
      secret: 'ock_whk_full_secret_value',
    };
    (createWebhookEndpoint as Mock).mockResolvedValue(minted);

    const res = (await POST(makeRequest(validBody), {})) as { status: number };

    expect(res.status).toBe(201);
    expect(apiSuccess).toHaveBeenCalledWith(
      { endpoint: minted.endpoint, secret: minted.secret },
      { status: 201 }
    );
    expect(createWebhookEndpoint).toHaveBeenCalledWith({
      userId: mockUser.id,
      actorId: validBody.actor_id,
      name: validBody.name,
      url: validBody.url,
      eventTypes: null,
    });
  });

  it('threads event_types through to the service', async () => {
    setSession(mockUser);
    (createWebhookEndpoint as Mock).mockResolvedValue({
      endpoint: { id: 'e-1', secret_prefix: 'ock_whk_abc' },
      secret: 'ock_whk_full',
    });

    await POST(makeRequest({ ...validBody, event_types: ['product.created'] }), {});

    expect(createWebhookEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypes: ['product.created'] })
    );
  });

  it('rejects event_types containing unknown events with 400 (no silent no-deliveries)', async () => {
    // Pre-2026-06-04 this passed validation and then silently never
    // fired — enqueueWebhookEvent's exact-match filter excludes
    // unknown events. The Zod schema now validates against the
    // PUBLIC_API_WEBHOOK_EVENTS SSOT.
    setSession(mockUser);

    const res = (await POST(makeRequest({ ...validBody, event_types: ['totally.fake'] }), {})) as {
      status: number;
    };

    expect(res.status).toBe(400);
    expect(apiValidationError).toHaveBeenCalled();
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });
});

// =============================================================================
// DELETE /api/webhook-endpoints/[id]
// =============================================================================

describe('DELETE /api/webhook-endpoints/[id]', () => {
  it('returns 401 when no session user', async () => {
    setSession(null);

    const res = (await DELETE(makeRequest(), withParams({ id: 'e-1' }))) as { status: number };

    expect(res.status).toBe(401);
    expect(revokeWebhookEndpoint).not.toHaveBeenCalled();
  });

  it('returns 404 when the service signals the endpoint was not revoked', async () => {
    setSession(mockUser);
    (revokeWebhookEndpoint as Mock).mockResolvedValue(false);

    const res = (await DELETE(makeRequest(), withParams({ id: 'e-1' }))) as { status: number };

    expect(res.status).toBe(404);
    expect(apiNotFound).toHaveBeenCalledWith('Webhook endpoint');
  });

  it('returns 200 with revoked:true on success', async () => {
    setSession(mockUser);
    (revokeWebhookEndpoint as Mock).mockResolvedValue(true);

    const res = (await DELETE(makeRequest(), withParams({ id: 'e-1' }))) as {
      ok: boolean;
      data: { revoked: boolean };
    };

    expect(res.ok).toBe(true);
    expect(res.data.revoked).toBe(true);
    expect(revokeWebhookEndpoint).toHaveBeenCalledWith('e-1', mockUser.id);
  });

  it('falls through to handleApiError when the service throws', async () => {
    setSession(mockUser);
    (revokeWebhookEndpoint as Mock).mockRejectedValue(new Error('boom'));

    const res = (await DELETE(makeRequest(), withParams({ id: 'e-1' }))) as { status: number };

    expect(res.status).toBe(500);
    expect(handleApiError).toHaveBeenCalled();
  });
});
