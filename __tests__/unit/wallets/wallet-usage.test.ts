/**
 * getSharedWalletUsage — the shared-wallet disclosure contract.
 *
 * Pins: bare-count semantics (self excluded), the owner-default flag,
 * xpub → fresh-address (no warning), group wallets → null, and that a
 * resolution failure degrades to null instead of breaking the page.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockResolve = vi.fn();
vi.mock('@/domain/payments', () => ({
  resolveSellerWallet: (...args: unknown[]) => mockResolve(...args),
}));

// Admin client mock: wallets lookups (single row + address twins) and
// entity_wallets link rows. Public client mock: RLS-visible sibling entities.
let walletRow: Record<string, unknown> | null = null;
let addressTwins: Array<{ id: string }> = [];
let linkRows: Array<{ entity_type: string; entity_id: string }> = [];
let visibleByTable: Record<string, string[]> = {};

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === 'wallets') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: walletRow }) }),
            or: async () => ({ data: addressTwins }),
          }),
        };
      }
      return { select: () => ({ in: async () => ({ data: linkRows }) }) };
    },
  }),
}));

import { getSharedWalletUsage } from '@/domain/wallets/walletUsage';

const supabase = {
  from: (table: string) => ({
    select: () => ({
      in: async (_col: string, ids: string[]) => ({
        data: (visibleByTable[table] ?? []).filter(id => ids.includes(id)).map(id => ({ id })),
      }),
    }),
  }),
} as never;
const ENTITY_ID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  mockResolve.mockReset();
  walletRow = { id: 'w1', is_primary: false, lightning_address: null, address_or_xpub: null };
  addressTwins = [];
  linkRows = [];
  visibleByTable = {};
});

describe('getSharedWalletUsage', () => {
  it('returns null when no wallet resolves', async () => {
    mockResolve.mockResolvedValue(null);
    expect(await getSharedWalletUsage(supabase, 'product', ENTITY_ID)).toBeNull();
  });

  it('counts sibling links but never the entity itself', async () => {
    mockResolve.mockResolvedValue({ method: 'onchain', wallet_id: 'w1' });
    linkRows = [
      { entity_type: 'product', entity_id: ENTITY_ID }, // self — excluded
      { entity_type: 'project', entity_id: 'other-1' },
      { entity_type: 'cause', entity_id: 'other-2' },
    ];
    visibleByTable = { projects: ['other-1'], user_causes: ['other-2'] };
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage).toEqual({
      shared_count: 2,
      is_owner_default: false,
      fresh_address_per_payment: false,
    });
  });

  it('flags the owner-default wallet (implicit sharing beyond explicit links)', async () => {
    mockResolve.mockResolvedValue({ method: 'lightning_address', wallet_id: 'w1' });
    walletRow = { id: 'w1', is_primary: true };
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.is_owner_default).toBe(true);
    expect(usage?.shared_count).toBe(0);
  });

  it('flags xpub wallets as fresh-address (payments not linkable)', async () => {
    mockResolve.mockResolvedValue({
      method: 'onchain',
      wallet_id: 'w1',
      onchain_xpub: 'zpub6xyz',
    });
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.fresh_address_per_payment).toBe(true);
  });

  it('returns null for group treasuries (wallet not in wallets table)', async () => {
    mockResolve.mockResolvedValue({ method: 'nwc', wallet_id: 'gw1' });
    walletRow = null;
    expect(await getSharedWalletUsage(supabase, 'group', ENTITY_ID)).toBeNull();
  });

  it('degrades to null when resolution throws — disclosure never breaks the page', async () => {
    mockResolve.mockRejectedValue(new Error('rail down'));
    expect(await getSharedWalletUsage(supabase, 'product', ENTITY_ID)).toBeNull();
  });
});

describe('getSharedWalletUsage — defects found by verifying against prod data', () => {
  it('counts reuse across DIFFERENT wallet rows holding the SAME address', async () => {
    // Prod really holds orangecat@coinos.io in two wallet rows (and one xpub in
    // eleven). Per-wallet_id counting reported "not shared" for the platform's
    // most visible reuse — the Loki/OrangeCat case.
    mockResolve.mockResolvedValue({ method: 'lightning_address', wallet_id: 'w1' });
    walletRow = {
      id: 'w1',
      is_primary: false,
      lightning_address: 'orangecat@coinos.io',
      address_or_xpub: null,
    };
    addressTwins = [{ id: 'w1' }, { id: 'w2' }];
    linkRows = [
      { entity_type: 'product', entity_id: ENTITY_ID }, // self, wallet w1
      { entity_type: 'product', entity_id: 'twin-linked' }, // via wallet w2
    ];
    visibleByTable = { user_products: ['twin-linked'] };
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.shared_count).toBe(1);
  });

  it('never counts links whose entity no longer exists (orphan rows)', async () => {
    // All nine links on one prod wallet pointed at deleted entities; the raw
    // count would have claimed "8 other pages" that a backer cannot open.
    mockResolve.mockResolvedValue({ method: 'onchain', wallet_id: 'w1' });
    linkRows = [
      { entity_type: 'product', entity_id: 'deleted-1' },
      { entity_type: 'cause', entity_id: 'deleted-2' },
    ];
    visibleByTable = {}; // RLS/existence returns nothing
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.shared_count).toBe(0);
  });

  it('counts only the publicly visible siblings, not drafts', async () => {
    mockResolve.mockResolvedValue({ method: 'onchain', wallet_id: 'w1' });
    linkRows = [
      { entity_type: 'product', entity_id: 'published' },
      { entity_type: 'product', entity_id: 'draft-hidden-by-rls' },
    ];
    visibleByTable = { user_products: ['published'] };
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.shared_count).toBe(1);
  });
});

describe('getSharedWalletUsage — owner-default detection', () => {
  it('flags the owner-default fallback when the entity has NO explicit link', async () => {
    // The Loki case: two passes both resolve to orangecat@coinos.io via
    // the fallback chain, with zero entity_wallets rows and a wallet row that
    // is not flagged primary. Keying on is_primary alone disclosed nothing.
    mockResolve.mockResolvedValue({ method: 'lightning_address', wallet_id: 'w1' });
    walletRow = {
      id: 'w1',
      is_primary: false,
      lightning_address: 'orangecat@coinos.io',
      address_or_xpub: null,
    };
    addressTwins = [{ id: 'w1' }];
    linkRows = []; // no link for this entity — fallback resolution
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.is_owner_default).toBe(true);
    expect(usage?.shared_count).toBe(0);
  });

  it('does NOT call an explicitly-linked, non-primary wallet the owner default', async () => {
    mockResolve.mockResolvedValue({ method: 'onchain', wallet_id: 'w1' });
    linkRows = [{ entity_type: 'product', entity_id: ENTITY_ID }]; // deliberate link
    const usage = await getSharedWalletUsage(supabase, 'product', ENTITY_ID);
    expect(usage?.is_owner_default).toBe(false);
  });
});
