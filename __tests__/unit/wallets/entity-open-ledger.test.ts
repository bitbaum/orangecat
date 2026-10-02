/**
 * When may a fund's page point at its wallet's public ledger?
 *
 * Only when both decisions are already public: the entity's primary wallet
 * link is `public` (the receiving address is on the page anyway) AND the
 * wallet opted into open accounting. Any other combination must name nothing,
 * because the link itself discloses which wallet receives for this entity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let linkRow: Record<string, unknown> | null = null;
let walletRow: Record<string, unknown> | null = null;
let linkError: unknown = null;
const linkFilters: Array<[string, unknown]> = [];

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === 'entity_wallets') {
        const chain = {
          select: () => chain,
          eq: (col: string, value: unknown) => {
            linkFilters.push([col, value]);
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: linkRow, error: linkError }),
        };
        return chain;
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: walletRow, error: null }) }),
        }),
      };
    },
  }),
}));

import { getEntityOpenLedgerWalletId } from '@/services/wallets/entityOpenLedger';

const ENTITY = '11111111-1111-4111-8111-111111111111';
const WALLET = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  linkFilters.length = 0;
  linkError = null;
  linkRow = { wallet_id: WALLET, visibility: 'public' };
  walletRow = { id: WALLET, is_active: true, open_accounting: true };
});

describe('getEntityOpenLedgerWalletId', () => {
  it('names the wallet when the link is public and the wallet publishes its ledger', async () => {
    await expect(getEntityOpenLedgerWalletId('cause', ENTITY)).resolves.toBe(WALLET);
  });

  it('reads the primary link for exactly this entity', async () => {
    await getEntityOpenLedgerWalletId('project', ENTITY);
    expect(linkFilters).toEqual([
      ['entity_type', 'project'],
      ['entity_id', ENTITY],
      ['is_primary', true],
    ]);
  });

  it.each(['private', 'total'])('names nothing when the link is %s', async visibility => {
    linkRow = { wallet_id: WALLET, visibility };
    await expect(getEntityOpenLedgerWalletId('cause', ENTITY)).resolves.toBeNull();
  });

  it('names nothing when the wallet has not opted into open accounting', async () => {
    walletRow = { id: WALLET, is_active: true, open_accounting: false };
    await expect(getEntityOpenLedgerWalletId('cause', ENTITY)).resolves.toBeNull();
  });

  it('names nothing when the wallet is inactive', async () => {
    walletRow = { id: WALLET, is_active: false, open_accounting: true };
    await expect(getEntityOpenLedgerWalletId('cause', ENTITY)).resolves.toBeNull();
  });

  it('names nothing when there is no primary link, or the read fails', async () => {
    linkRow = null;
    await expect(getEntityOpenLedgerWalletId('cause', ENTITY)).resolves.toBeNull();
    linkRow = { wallet_id: WALLET, visibility: 'public' };
    linkError = { message: 'boom' };
    await expect(getEntityOpenLedgerWalletId('cause', ENTITY)).resolves.toBeNull();
  });
});
