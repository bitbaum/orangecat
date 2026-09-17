/**
 * The profile page counted a visitor-visible wallet through an RPC that has
 * never existed. `get_entity_wallets` appears in no migration and returns
 * PGRST202 in production, and the call sat inside a try/catch whose comment read
 * "if it errs we just show 0" — so the error path was not a fallback, it was the
 * only path.
 *
 * The count is not cosmetic: ProfileLayout hides the Wallets tab from visitors
 * unless `walletCount > 0` or the profile still carries a legacy address, so a
 * profile whose receive methods live in the modern wallets table showed a
 * visitor no way to pay it at all.
 *
 * These tests pin the two properties that matter. First that a real count comes
 * back. Second — the part that let the original hide for so long — that a
 * failure is LOGGED, not swallowed. Zero is still returned, because a badge must
 * not promise a payment method that might not be there; the difference is that
 * it now leaves evidence.
 *
 * Gated by scripts/check-rpc-exists.mjs; this is the instance.
 */

const from = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({ from }),
}));

const errorLog = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { error: (...args: unknown[]) => errorLog(...args), info: vi.fn(), warn: vi.fn() },
}));

import { countActiveProfileWallets } from '@/services/wallets/countPublicWallets';

/** Mimics the PostgREST builder chain, capturing the filters applied. */
function mockQuery(result: { count?: number | null; error?: { message: string; code?: string } }) {
  const filters: Record<string, unknown> = {};
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((col: string, val: unknown) => {
      filters[col] = val;
      return chain;
    }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  from.mockReturnValue(chain);
  return { chain, filters };
}

describe('countActiveProfileWallets', () => {
  beforeEach(() => {
    from.mockReset();
    errorLog.mockReset();
  });

  it('returns the number of active wallets for the profile', async () => {
    const { filters } = mockQuery({ count: 3, error: undefined });
    await expect(countActiveProfileWallets('p-1')).resolves.toBe(3);
    expect(filters).toEqual({ profile_id: 'p-1', is_active: true });
  });

  it('counts only active wallets — an inactive one must not imply a way to pay', async () => {
    const { filters } = mockQuery({ count: 0, error: undefined });
    await expect(countActiveProfileWallets('p-2')).resolves.toBe(0);
    expect(filters.is_active).toBe(true);
  });

  it('logs the failure instead of swallowing it, which is how the old bug hid', async () => {
    mockQuery({ count: null, error: { message: 'boom', code: 'PGRST202' } });
    await expect(countActiveProfileWallets('p-3')).resolves.toBe(0);
    expect(errorLog).toHaveBeenCalledWith(
      'Failed to count profile wallets',
      expect.objectContaining({ profileId: 'p-3', code: 'PGRST202' })
    );
  });

  it('survives a thrown client and still logs', async () => {
    from.mockImplementation(() => {
      throw new Error('no client');
    });
    await expect(countActiveProfileWallets('p-4')).resolves.toBe(0);
    expect(errorLog).toHaveBeenCalledWith(
      'Unexpected error counting profile wallets',
      expect.objectContaining({ profileId: 'p-4' })
    );
  });

  it('treats a null count as zero rather than NaN', async () => {
    mockQuery({ count: null, error: undefined });
    await expect(countActiveProfileWallets('p-5')).resolves.toBe(0);
  });
});
