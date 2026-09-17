/**
 * resolveSellerWallet — entity-linked wallet precedence.
 *
 * An owner may have several wallets and tie a specific one to an entity via
 * entity_wallets. That link MUST win over the owner's profile-default wallet, so
 * funds go where the owner chose for that entity. When no (usable) link exists,
 * resolution falls back to the owner's primary profile wallet.
 */

import { resolveSellerWallet } from '@/domain/payments/walletResolutionService';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
// decrypt is identity here — we only assert which wallet is chosen, not crypto.
vi.mock('@/domain/payments/encryptionService', () => ({ decrypt: (s: string) => s }));

const getAdminClientMock = getAdminClient as Mock;

interface Fixtures {
  entityWallets: Array<{ wallet_id: string; is_primary: boolean }>;
  walletsById: Record<string, Record<string, unknown>>;
  entity: Record<string, unknown> | null;
  actor: Record<string, unknown> | null;
  userWallets: Array<Record<string, unknown>>;
}

/**
 * Table-aware fake. `.single()` resolves a one-row lookup; `.order()` is the
 * terminal for list queries and returns a thenable that is itself re-orderable
 * (resolveUserWallet chains two .order() calls).
 */
function makeAdmin(fx: Fixtures) {
  function from(table: string) {
    const filters: Record<string, unknown> = {};
    const listResult = {
      order: () => listResult,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        const data =
          table === DATABASE_TABLES.ENTITY_WALLETS
            ? fx.entityWallets
            : table === DATABASE_TABLES.WALLETS
              ? fx.userWallets
              : [];
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      in: () => builder,
      order: () => listResult,
      single: () => {
        let data: unknown = null;
        if (table === DATABASE_TABLES.WALLETS) {
          data = fx.walletsById[filters.id as string] ?? null;
        } else if (table === DATABASE_TABLES.ACTORS) {
          data = fx.actor;
        } else {
          data = fx.entity; // entity table (e.g. user_products)
        }
        return Promise.resolve({ data, error: null });
      },
    };
    return builder;
  }
  return { from } as never;
}

const ENTITY = { entity_type: 'product' as const, entity_id: 'prod-1' };

function baseFixtures(): Fixtures {
  return {
    entityWallets: [],
    walletsById: {},
    entity: { id: 'prod-1', actor_id: 'actor-1' },
    actor: { actor_type: 'user', user_id: 'user-1', group_id: null },
    userWallets: [
      {
        id: 'w-primary',
        nwc_connection_uri: null,
        lightning_address: null,
        address_or_xpub: 'bc1-primary',
        wallet_type: 'onchain',
        is_primary: true,
      },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());

describe('resolveSellerWallet — entity-linked wallet precedence', () => {
  it('uses the wallet tied to the entity over the profile default', async () => {
    const fx = baseFixtures();
    fx.entityWallets = [{ wallet_id: 'w-linked', is_primary: true }];
    fx.walletsById = {
      'w-linked': {
        id: 'w-linked',
        nwc_connection_uri: null,
        lightning_address: null,
        address_or_xpub: 'bc1-linked',
      },
    };
    getAdminClientMock.mockReturnValue(makeAdmin(fx));

    const resolved = await resolveSellerWallet(ENTITY.entity_type, ENTITY.entity_id);

    expect(resolved).toEqual({
      method: 'onchain',
      wallet_id: 'w-linked',
      onchain_address: 'bc1-linked',
    });
  });

  it('honours the linked wallet method priority (Lightning over on-chain)', async () => {
    const fx = baseFixtures();
    fx.entityWallets = [{ wallet_id: 'w-linked', is_primary: true }];
    fx.walletsById = {
      'w-linked': {
        id: 'w-linked',
        nwc_connection_uri: null,
        lightning_address: 'me@ln.example',
        address_or_xpub: 'bc1-linked',
      },
    };
    getAdminClientMock.mockReturnValue(makeAdmin(fx));

    const resolved = await resolveSellerWallet(ENTITY.entity_type, ENTITY.entity_id);

    expect(resolved).toEqual({
      method: 'lightning_address',
      wallet_id: 'w-linked',
      lightning_address: 'me@ln.example',
    });
  });

  it('falls back to the primary profile wallet when no link exists', async () => {
    const fx = baseFixtures(); // entityWallets empty
    getAdminClientMock.mockReturnValue(makeAdmin(fx));

    const resolved = await resolveSellerWallet(ENTITY.entity_type, ENTITY.entity_id);

    expect(resolved).toEqual({
      method: 'onchain',
      wallet_id: 'w-primary',
      onchain_address: 'bc1-primary',
    });
  });

  it('falls back to the primary wallet when the linked wallet is inactive/missing', async () => {
    const fx = baseFixtures();
    fx.entityWallets = [{ wallet_id: 'w-gone', is_primary: true }];
    fx.walletsById = {}; // linked wallet not active → single() returns null
    getAdminClientMock.mockReturnValue(makeAdmin(fx));

    const resolved = await resolveSellerWallet(ENTITY.entity_type, ENTITY.entity_id);

    expect(resolved).toEqual({
      method: 'onchain',
      wallet_id: 'w-primary',
      onchain_address: 'bc1-primary',
    });
  });
});
