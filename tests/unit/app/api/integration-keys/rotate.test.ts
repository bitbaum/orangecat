/**
 * POST /api/integration-keys/[id]/rotate — handler-level branch tests.
 *
 * Rotation is the leak-response path: when a user thinks they've burnt
 * a key, they MUST actually have burnt it. Silent regressions here
 * (e.g. an error path that 500s instead of 403/404, or a misclassified
 * exception that's never reached) would either falsely-fail rotation
 * (user keeps shipping the leaked key) or falsely-succeed it (old key
 * stays live). Lock the 5 branches before customers hit them.
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

vi.mock('@/services/auth/integrationKeys', () => {
  class ActorNotPermittedError extends Error {}
  return {
    rotateIntegrationKey: vi.fn(),
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
  handleApiError: vi.fn((err: Error) => ({ ok: false, error: err.message, status: 500 })),
}));

import { POST } from '@/app/api/integration-keys/[id]/rotate/route';
import { createServerClient } from '@/lib/supabase/server';
import { rotateIntegrationKey, ActorNotPermittedError } from '@/services/auth/integrationKeys';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRequest(): any {
  return { url: 'http://x/api/integration-keys/k-1/rotate' };
}

function withParams<T extends Record<string, string>>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/integration-keys/[id]/rotate', () => {
  it('returns 401 when no session user', async () => {
    setSession(null);

    const res = (await POST(makeRequest(), withParams({ id: 'k-1' }))) as { status: number };

    expect(res.status).toBe(401);
    expect(apiUnauthorized).toHaveBeenCalled();
    expect(rotateIntegrationKey).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is no longer permitted to act as the key's actor", async () => {
    setSession(mockUser);
    (rotateIntegrationKey as Mock).mockRejectedValue(
      new ActorNotPermittedError('lost group membership')
    );

    const res = (await POST(makeRequest(), withParams({ id: 'k-1' }))) as { status: number };

    expect(res.status).toBe(403);
    expect(apiForbidden).toHaveBeenCalledWith(
      "You are no longer permitted to act as this key's actor."
    );
    // Generic 500 must NOT have been called — the branch routing matters.
    expect(handleApiError).not.toHaveBeenCalled();
    expect(apiNotFound).not.toHaveBeenCalled();
  });

  it('returns 404 (Integration key) on the "Key not found" sentinel error', async () => {
    setSession(mockUser);
    (rotateIntegrationKey as Mock).mockRejectedValue(new Error('Key not found'));

    const res = (await POST(makeRequest(), withParams({ id: 'k-1' }))) as { status: number };

    expect(res.status).toBe(404);
    // 404 — never 409 — so probers can't tell missing-key from wrong-owner.
    expect(apiNotFound).toHaveBeenCalledWith('Integration key');
    expect(handleApiError).not.toHaveBeenCalled();
  });

  it('falls through to handleApiError for unknown exceptions', async () => {
    setSession(mockUser);
    (rotateIntegrationKey as Mock).mockRejectedValue(new Error('connection_reset'));

    const res = (await POST(makeRequest(), withParams({ id: 'k-1' }))) as { status: number };

    expect(res.status).toBe(500);
    expect(handleApiError).toHaveBeenCalled();
    // Specific branches did not also fire.
    expect(apiForbidden).not.toHaveBeenCalled();
    expect(apiNotFound).not.toHaveBeenCalled();
  });

  it('returns 201 with key + plaintext on success', async () => {
    setSession(mockUser);
    const minted = {
      key: { id: 'k-2', key_prefix: 'ock_abcdefg', name: 'rotated' },
      plaintext: 'ock_full_secret_value',
    };
    (rotateIntegrationKey as Mock).mockResolvedValue(minted);

    const res = (await POST(makeRequest(), withParams({ id: 'k-1' }))) as {
      ok: boolean;
      data: { key: unknown; plaintext: string };
      status: number;
    };

    expect(res.status).toBe(201);
    expect(res.ok).toBe(true);
    expect(rotateIntegrationKey).toHaveBeenCalledWith('k-1', mockUser.id);
    expect(apiSuccess).toHaveBeenCalledWith(
      { key: minted.key, plaintext: minted.plaintext },
      { status: 201 }
    );
  });
});
