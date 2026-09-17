/**
 * /api/v1/payments — machine-payable contract tests
 *
 * Covers: OpenAPI spec generation includes the payment paths, and the POST
 * route's auth/scope/visibility gates (the parts that differ from the
 * session-only internal route it wraps).
 */

import { POST } from '@/app/api/v1/payments/route';
import { resolveRequestAuth } from '@/lib/api/resolveRequestAuth';
import { initiatePayment } from '@/domain/payments';
import type { NextRequest } from 'next/server';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/resolveRequestAuth', async () => ({
  ...((await vi.importActual('@/lib/api/resolveRequestAuth')) as object),
  resolveRequestAuth: vi.fn(),
}));

// NextResponse is unavailable in the jest env — repo convention is to mock the
// response helpers with plain status/json shims (see projects-id-api.test.ts).
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown, opts?: { status?: number }) => ({
    status: opts?.status ?? 200,
    json: async () => ({ success: true, data }),
  })),
  apiUnauthorized: vi.fn(() => ({
    status: 401,
    json: async () => ({ success: false, error: { message: 'Unauthorized' } }),
  })),
  apiForbidden: vi.fn((message = 'Forbidden') => ({
    status: 403,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiNotFound: vi.fn((message = 'Not found') => ({
    status: 404,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiBadRequest: vi.fn((message = 'Bad request') => ({
    status: 400,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiRateLimited: vi.fn(() => ({
    status: 429,
    json: async () => ({ success: false, error: { message: 'Rate limited' } }),
  })),
  apiInternalError: vi.fn((message = 'Internal error') => ({
    status: 500,
    json: async () => ({ success: false, error: { message } }),
  })),
}));

vi.mock('@/domain/payments', () => ({
  initiatePayment: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  rateLimitPaymentRecipient: vi.fn().mockResolvedValue({ success: true }),
  rateLimitIntegrationKeyWrite: vi.fn().mockResolvedValue({ success: true }),
  rateLimitIntegrationKeyRead: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: vi.fn().mockReturnValue(30),
}));

// Public client controls the anonymous-visibility gate for key auth.
const mockPublicMaybeSingle = vi.fn();
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockPublicMaybeSingle,
    })),
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({ _kind: 'session-client' })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ _kind: 'admin-client' })),
}));

const mockResolveRequestAuth = resolveRequestAuth as Mock;
const mockInitiatePayment = initiatePayment as Mock;

const ENTITY_ID = '11111111-2222-3333-4444-555555555555';

function makeRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: async () => body,
  } as unknown as NextRequest;
}

function keyAuth(scopes: string[]) {
  return {
    userId: 'buyer-1',
    boundActorId: 'actor-1',
    source: 'integration_key',
    integrationKeyId: 'key-1',
    scopes,
    isTest: false,
  };
}

describe('POST /api/v1/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicMaybeSingle.mockResolvedValue({ data: { id: ENTITY_ID } });
    mockInitiatePayment.mockResolvedValue({
      payment_intent: { id: 'pi-1', status: 'invoice_ready' },
      qr_data: 'lightning:lnbc…',
      method_label: 'Lightning',
      expires_in_seconds: 600,
    });
  });

  it('returns 401 without auth', async () => {
    mockResolveRequestAuth.mockResolvedValue(null);

    const res = await POST(makeRequest({ entity_type: 'product', entity_id: ENTITY_ID }));

    expect(res.status).toBe(401);
    expect(mockInitiatePayment).not.toHaveBeenCalled();
  });

  it('returns 403 when the key lacks payments.write', async () => {
    mockResolveRequestAuth.mockResolvedValue(keyAuth(['products.write']));

    const res = await POST(makeRequest({ entity_type: 'product', entity_id: ENTITY_ID }));

    expect(res.status).toBe(403);
    expect(mockInitiatePayment).not.toHaveBeenCalled();
  });

  it('returns 404 for key auth when the entity is not publicly visible', async () => {
    mockResolveRequestAuth.mockResolvedValue(keyAuth(['payments.write']));
    mockPublicMaybeSingle.mockResolvedValue({ data: null });

    const res = await POST(makeRequest({ entity_type: 'product', entity_id: ENTITY_ID }));

    expect(res.status).toBe(404);
    expect(mockInitiatePayment).not.toHaveBeenCalled();
  });

  it('creates a payment for key auth on a public entity, attributed to the key user', async () => {
    mockResolveRequestAuth.mockResolvedValue(keyAuth(['payments.write']));

    const res = await POST(makeRequest({ entity_type: 'product', entity_id: ENTITY_ID }));

    expect(res.status).toBe(201);
    expect(mockInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ _kind: 'admin-client' }),
      'buyer-1',
      expect.objectContaining({ entity_type: 'product', entity_id: ENTITY_ID })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.payment_intent.id).toBe('pi-1');
  });

  it('skips the anonymous-visibility gate for session auth (RLS covers it)', async () => {
    mockResolveRequestAuth.mockResolvedValue({
      userId: 'buyer-1',
      boundActorId: null,
      source: 'session',
      integrationKeyId: null,
      scopes: ['*'],
      isTest: false,
    });

    const res = await POST(makeRequest({ entity_type: 'product', entity_id: ENTITY_ID }));

    expect(res.status).toBe(201);
    expect(mockPublicMaybeSingle).not.toHaveBeenCalled();
    expect(mockInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ _kind: 'session-client' }),
      'buyer-1',
      expect.anything()
    );
  });

  it('maps known domain errors to a safe 400', async () => {
    mockResolveRequestAuth.mockResolvedValue(keyAuth(['payments.write']));
    mockInitiatePayment.mockRejectedValue(new Error('Cannot purchase your own entity'));

    const res = await POST(makeRequest({ entity_type: 'product', entity_id: ENTITY_ID }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('You cannot pay for your own entity');
  });

  it('rejects an invalid body with 400 before touching the domain', async () => {
    mockResolveRequestAuth.mockResolvedValue(keyAuth(['payments.write']));

    const res = await POST(makeRequest({ entity_type: 'nope', entity_id: 'not-a-uuid' }));

    expect(res.status).toBe(400);
    expect(mockInitiatePayment).not.toHaveBeenCalled();
  });
});

describe('OpenAPI spec — payment paths', () => {
  it('includes the machine-payable loop endpoints', async () => {
    // Imported lazily so the route-level mocks above don't interfere.
    const { getOpenApiSpec } = (await vi.importActual('@/lib/openapi/generator')) as {
      getOpenApiSpec: () => { paths: Record<string, Record<string, unknown>> };
    };
    const spec = getOpenApiSpec();

    expect(spec.paths['/api/v1/payments']?.post).toBeDefined();
    expect(spec.paths['/api/v1/payments/{id}']?.get).toBeDefined();
    expect(spec.paths['/api/v1/payments/public']?.post).toBeDefined();
  });
});
