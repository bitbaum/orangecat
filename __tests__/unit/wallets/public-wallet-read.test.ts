/**
 * The one read that serves a wallet to somebody who does not own it.
 *
 * Wallet rows are owner-only at the RLS level and `REVOKE SELECT ... FROM anon`
 * means nothing anonymous can reach them directly — so every public surface
 * goes through a service-role read with a curated column list and redaction.
 * That combination lived inline in GET /api/wallets and was about to be written
 * a second time for the public wallet page. Its FIRST copy is the one that
 * served real zpubs to anonymous callers (#743), so it now has a single home
 * and these tests guard it.
 */

import { readPublicWallets, PUBLIC_WALLET_FIELDS } from '@/services/wallets/publicWalletRead';

const captured: { select?: string; filters: Array<[string, unknown]> } = { filters: [] };
let rows: Array<Record<string, unknown>> = [];
let adminAvailable = true;

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => {
    if (!adminAvailable) {
      // Mirrors the real Proxy, which throws on any property access when the
      // service-role key is absent.
      throw new Error('admin client unavailable');
    }
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order']) {
      chain[m] = (...args: unknown[]) => {
        if (m === 'select') {
          captured.select = args[0] as string;
        }
        if (m === 'eq') {
          captured.filters.push([args[0] as string, args[1]]);
        }
        return chain;
      };
    }
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return { from: () => chain };
  },
}));

beforeEach(() => {
  captured.select = undefined;
  captured.filters = [];
  rows = [];
  adminAvailable = true;
});

describe('PUBLIC_WALLET_FIELDS', () => {
  it('withholds every column that would be a new disclosure of financial data', () => {
    // This list IS the privacy boundary. Adding a column here publishes it to
    // anyone with a link — so each of these is spelled out, and a future
    // addition has to delete an assertion to do it. That deletion is the
    // decision; the point is that it cannot happen absent-mindedly.
    for (const withheld of [
      'balance_btc', // what someone holds is nobody else's business
      'balance_updated_at',
      'description', // a wallet labelled "medical costs" is theirs to disclose
      'goal_amount',
      'goal_currency',
      'goal_deadline',
      'budget_amount',
      'nwc_connection_uri', // a secret the DB will not even grant to client roles
      'is_active', // absent on purpose — a client-side filter on it dropped every card
    ]) {
      expect(PUBLIC_WALLET_FIELDS).not.toContain(withheld);
    }
  });

  it('still carries what a payer actually needs', () => {
    for (const needed of ['id', 'label', 'wallet_type', 'lightning_address', 'address_or_xpub']) {
      expect(PUBLIC_WALLET_FIELDS).toContain(needed);
    }
  });
});

describe('readPublicWallets', () => {
  it('asks only for the curated columns, and only for live wallets', async () => {
    await readPublicWallets({ profileId: 'profile-1' });

    expect(captured.select).toBe(PUBLIC_WALLET_FIELDS);
    expect(captured.filters).toContainEqual(['is_active', true]);
    expect(captured.filters).toContainEqual(['profile_id', 'profile-1']);
  });

  it('scopes by project or by wallet id when asked that way', async () => {
    await readPublicWallets({ projectId: 'project-7' });
    expect(captured.filters).toContainEqual(['project_id', 'project-7']);

    captured.filters = [];
    await readPublicWallets({ walletId: 'w-42' });
    expect(captured.filters).toContainEqual(['id', 'w-42']);
  });

  it('nulls an extended public key but passes a plain address through', async () => {
    rows = [
      { id: 'a', address_or_xpub: 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs' },
      { id: 'b', address_or_xpub: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' },
    ];

    const out = await readPublicWallets({ profileId: 'p' });

    // An xpub is not an address — it is the key every address derives from, so
    // publishing one hands over the wallet's entire history and future.
    expect(out[0].address_or_xpub).toBeNull();
    // Withholding a plain address would break the only thing this list is for.
    expect(out[1].address_or_xpub).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
  });

  it('degrades to no wallets, not to a stack trace, without a service-role key', async () => {
    adminAvailable = false;
    await expect(readPublicWallets({ profileId: 'p' })).resolves.toEqual([]);
  });
});
