/**
 * Delete Account (and removing one identity) works for someone who owns pages.
 *
 * On production (2026-11-12) POST /api/delete-user asked GoTrue to delete the
 * auth user and nothing else. The cascade auth.users → profiles → actors then
 * hit eight page tables whose NOT NULL actor_id answers with ON DELETE SET
 * NULL, so Postgres refused and the person was told "Failed to delete
 * account". Every creator. DELETE /api/identities/[id] had the same gap.
 *
 * Both now clear the account's pages first (delete_account_pages, one
 * transaction, migration 20261112203000) and only then delete the auth user —
 * for every identity the account holds, then for the account itself. A page
 * cleanup that fails stops Delete Account before anything leaves auth.
 */

import { POST } from '@/app/api/delete-user/route';
import { DELETE } from '@/app/api/identities/[id]/route';
import { heldIdentityIds } from '@/domain/identities/service';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown, ctx?: unknown) => Promise<unknown>) =>
    (req: unknown, ctx?: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'ana' }, supabase: {} }), ctx),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: () => 0,
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 200, data })),
  apiInternalError: vi.fn((error: string) => ({ status: 500, error })),
  apiBadRequest: vi.fn((error: string) => ({ status: 400, error })),
  apiNotFound: vi.fn(() => ({ status: 404 })),
  apiRateLimited: vi.fn(() => ({ status: 429 })),
  handleApiError: vi.fn(() => ({ status: 500 })),
}));
vi.mock('@/lib/auth/session-methods', () => ({
  sessionMethods: vi.fn().mockResolvedValue(['password']),
}));
vi.mock('@/services/auth/connectedApps', () => ({
  revokeAllConnectedApps: vi.fn().mockResolvedValue(undefined),
}));

/** Every call made, in order, as `rpc:<fn>:<user>` / `deleteUser:<user>`. */
const calls: string[] = [];
let rpcError: { message: string } | null = null;
const admin = {
  rpc: vi.fn(async (fn: string, params: { p_user: string }) => {
    calls.push(`rpc:${fn}:${params.p_user}`);
    return { data: 3, error: rpcError };
  }),
  auth: {
    admin: {
      deleteUser: vi.fn(async (id: string) => {
        calls.push(`deleteUser:${id}`);
        return { error: null };
      }),
    },
  },
};
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn(() => admin) }));

// The circle checks are the identities service's own (tested there); here the
// service only runs the route's beforeDelete and then deletes, as it does.
vi.mock('@/domain/identities/service', () => ({
  heldIdentityIds: vi.fn(),
  deleteIdentity: vi.fn(
    async (
      sb: typeof admin,
      _caller: unknown,
      id: string,
      beforeDelete: (identityId: string) => Promise<unknown>
    ) => {
      await beforeDelete(id);
      await sb.auth.admin.deleteUser(id);
      return { ok: true, data: { id } };
    }
  ),
}));

const heldMock = heldIdentityIds as Mock;
const IDENTITY = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';

beforeEach(() => {
  calls.length = 0;
  rpcError = null;
  heldMock.mockResolvedValue([]);
});

describe('POST /api/delete-user', () => {
  it("clears the account's pages before GoTrue deletes the user", async () => {
    const res = (await POST({} as never)) as { status: number };

    expect(res.status).toBe(200);
    expect(calls).toEqual(['rpc:delete_account_pages:ana', 'deleteUser:ana']);
  });

  it('does the same for every identity the account holds, each before its own delete', async () => {
    heldMock.mockResolvedValue(['alberto', 'ricardo']);

    const res = (await POST({} as never)) as { status: number };

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      'rpc:delete_account_pages:alberto',
      'deleteUser:alberto',
      'rpc:delete_account_pages:ricardo',
      'deleteUser:ricardo',
      'rpc:delete_account_pages:ana',
      'deleteUser:ana',
    ]);
  });

  it('stops before deleting anyone when the pages cannot be cleared', async () => {
    rpcError = { message: 'boom' };

    const res = (await POST({} as never)) as { status: number; error: string };

    expect(res.status).toBe(500);
    expect(res.error).toBe('Failed to delete account. Please try again.');
    expect(calls).toEqual(['rpc:delete_account_pages:ana']);
  });
});

describe('DELETE /api/identities/[id]', () => {
  it("clears the identity's pages before GoTrue deletes it", async () => {
    const res = (await DELETE({} as never, { params: Promise.resolve({ id: IDENTITY }) })) as {
      status: number;
    };

    expect(res.status).toBe(200);
    expect(calls).toEqual([`rpc:delete_account_pages:${IDENTITY}`, `deleteUser:${IDENTITY}`]);
  });
});
