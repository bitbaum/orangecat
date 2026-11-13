/**
 * Delete Account (and removing one identity) is one database transaction.
 *
 * The first version of this fix deleted the account's pages in one RPC and then
 * asked GoTrue to delete the user. A review found that when the second step
 * failed, the person was told "Failed to delete account. Please try again."
 * while every page they owned was already gone. Both routes now make one call,
 * delete_account (migration 20261112203000), which deletes the pages, hands
 * over groups and deletes the auth.users rows in a single transaction, for
 * every identity the account holds and then the account. GoTrue's admin
 * delete is no longer called. When the call fails, nothing was removed, and
 * the response says so; when an order still ships to the person, it says that.
 */

import { POST } from '@/app/api/delete-user/route';
import { DELETE } from '@/app/api/identities/[id]/route';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';
import { IDENTITIES_COPY } from '@/config/identities';
import { heldIdentityIds } from '@/domain/identities/service';
import { revokeAllConnectedApps } from '@/services/auth/connectedApps';

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
  apiConflict: vi.fn((error: string) => ({ status: 409, error })),
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
  revokeAllConnectedApps: vi.fn(async (id: string) => {
    calls.push(`revoke:${id}`);
  }),
}));

/** Every call made, in order, as `rpc:<fn>:<user>` / `revoke:<user>` / `deleteUser:<user>`. */
const calls: string[] = [];
let rpcError: { message: string } | null = null;
const admin = {
  rpc: vi.fn(async (fn: string, params: { p_user: string }) => {
    calls.push(`rpc:${fn}:${params.p_user}`);
    return { data: rpcError ? null : { accounts: 1 }, error: rpcError };
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
// service only runs the route's remove callback, as it does once they pass.
vi.mock('@/domain/identities/service', () => ({
  heldIdentityIds: vi.fn(),
  deleteIdentity: vi.fn(
    async (
      _sb: unknown,
      _caller: unknown,
      id: string,
      remove: (identityId: string) => Promise<string | null>
    ) => {
      const error = await remove(id);
      return error ? { ok: false, reason: 'failed', message: error } : { ok: true, data: { id } };
    }
  ),
}));

const heldMock = heldIdentityIds as Mock;
const IDENTITY = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';

beforeEach(() => {
  calls.length = 0;
  rpcError = null;
  heldMock.mockResolvedValue([]);
  (revokeAllConnectedApps as Mock).mockClear();
});

describe('POST /api/delete-user', () => {
  it('revokes connected apps, then deletes the account in one call, never through GoTrue', async () => {
    const res = (await POST({} as never)) as { status: number };

    expect(res.status).toBe(200);
    expect(calls).toEqual(['revoke:ana', 'rpc:delete_account:ana']);
  });

  it("revokes every held identity's apps, and leaves deleting them to the same one call", async () => {
    heldMock.mockResolvedValue(['alberto', 'ricardo']);

    const res = (await POST({} as never)) as { status: number };

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      'revoke:alberto',
      'revoke:ricardo',
      'revoke:ana',
      'rpc:delete_account:ana',
    ]);
  });

  it('says nothing was removed when the transaction fails', async () => {
    rpcError = { message: 'boom' };

    const res = (await POST({} as never)) as { status: number; error: string };

    expect(res.status).toBe(500);
    expect(res.error).toBe(ACCOUNT_DELETION_COPY.notDeleted);
    expect(res.error).toMatch(/not deleted and none of your data was removed/);
    expect(calls).not.toContain('deleteUser:ana');
  });

  it('refuses with a reason while an order still ships to the person', async () => {
    rpcError = { message: 'account_has_unshipped_orders' };

    const res = (await POST({} as never)) as { status: number; error: string };

    expect(res.status).toBe(409);
    expect(res.error).toBe(ACCOUNT_DELETION_COPY.unshippedOrders);
  });
});

describe('DELETE /api/identities/[id]', () => {
  it('revokes its apps, then deletes the identity in one call', async () => {
    const res = (await DELETE({} as never, { params: Promise.resolve({ id: IDENTITY }) })) as {
      status: number;
    };

    expect(res.status).toBe(200);
    expect(calls).toEqual([`revoke:${IDENTITY}`, `rpc:delete_account:${IDENTITY}`]);
  });

  it('says it could not delete the identity when the transaction fails', async () => {
    rpcError = { message: 'boom' };

    const res = (await DELETE({} as never, { params: Promise.resolve({ id: IDENTITY }) })) as {
      status: number;
      error: string;
    };

    expect(res.status).toBe(500);
    expect(res.error).toBe(IDENTITIES_COPY.removeFailed);
  });
});
