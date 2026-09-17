/**
 * Wallet resolution — the query itself is the safety property.
 *
 * Resolution decides WHO GETS THE MONEY, and most of that decision lives in
 * filters and orderings rather than in branches: `is_active`, `profile_id`,
 * `group_id`, primary-first. Mutation testing showed those were unconstrained —
 * every filter could be deleted and the suite stayed green, because the old
 * doubles returned a fixed row no matter what was asked.
 *
 * These tests run against a fake that actually applies the query
 * (test-utils/fakeSupabase), and each one is written so that removing a single
 * filter changes which wallet is chosen:
 *  - a deactivated wallet is present and must NOT win,
 *  - someone else's wallet is present and must NEVER win,
 *  - the primary wallet is listed second so ordering has to do real work.
 */

import {
  resolveUserWallet,
  resolveSpecificUserWallet,
  resolveSellerWallet,
} from '@/domain/payments/walletResolutionService';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata } from '@/config/entity-registry';
import { createFakeSupabase, type Row } from '../../../../test-utils/fakeSupabase';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
// Identity decrypt: these tests assert which wallet wins, not the crypto.
vi.mock('@/domain/payments/encryptionService', () => ({
  decrypt: vi.fn((s: string) => s),
}));

import { getAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/domain/payments/encryptionService';
import type { Mock } from 'vitest';

const getAdminClientMock = getAdminClient as Mock;
const decryptMock = decrypt as Mock;

const OWNER = 'user-1';
const STRANGER = 'user-2';

function wallet(over: Row): Row {
  return {
    id: 'w',
    profile_id: OWNER,
    is_active: true,
    is_primary: false,
    wallet_type: 'onchain',
    nwc_connection_uri: null,
    lightning_address: null,
    address_or_xpub: null,
    created_at: '2026-01-01',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  decryptMock.mockImplementation((s: string) => s);
});

describe('resolveUserWallet — the wallet set it is allowed to choose from', () => {
  it('never resolves to a deactivated wallet, even when it is the only one with a rail', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-dead', is_active: false, is_primary: true, lightning_address: 'dead@ln' }),
      ],
    });

    expect(await resolveUserWallet(client, OWNER)).toBeNull();
  });

  it('never resolves to another user’s wallet', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-theirs', profile_id: STRANGER, lightning_address: 'theirs@ln' }),
      ],
    });

    expect(await resolveUserWallet(client, OWNER)).toBeNull();
  });

  it('prefers the primary wallet when several are equally capable', async () => {
    // Deliberately listed non-primary first: only a real primary-first ordering
    // picks w-primary here.
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-secondary', lightning_address: 'second@ln', created_at: '2026-01-01' }),
        wallet({
          id: 'w-primary',
          is_primary: true,
          lightning_address: 'first@ln',
          created_at: '2026-06-01',
        }),
      ],
    });

    const resolved = await resolveUserWallet(client, OWNER);

    expect(resolved).toEqual({
      method: 'lightning_address',
      wallet_id: 'w-primary',
      lightning_address: 'first@ln',
    });
  });

  it('breaks ties between non-primary wallets by age, oldest first', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-new', lightning_address: 'new@ln', created_at: '2026-06-01' }),
        wallet({ id: 'w-old', lightning_address: 'old@ln', created_at: '2026-01-01' }),
      ],
    });

    expect(await resolveUserWallet(client, OWNER)).toMatchObject({ wallet_id: 'w-old' });
  });

  it('prefers NWC over a Lightning address held by a different wallet', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-ln', is_primary: true, lightning_address: 'me@ln' }),
        wallet({ id: 'w-nwc', nwc_connection_uri: 'nostr+walletconnect://relay' }),
      ],
    });

    // NWC still wins. It now also carries the OTHER wallet's lightning address
    // as a receive fallback: they pay the same owner, and a send-only NWC that
    // cannot mint invoices must not take receiving down with it.
    expect(await resolveUserWallet(client, OWNER)).toEqual({
      method: 'nwc',
      wallet_id: 'w-nwc',
      nwc_uri: 'nostr+walletconnect://relay',
      lightning_address: 'me@ln',
    });
  });

  it('falls through to Lightning when the NWC secret cannot be decrypted', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-nwc', nwc_connection_uri: 'CORRUPT' }),
        wallet({ id: 'w-ln', lightning_address: 'me@ln' }),
      ],
    });
    decryptMock.mockImplementation((s: string) => {
      if (s === 'CORRUPT') {
        throw new Error('bad key');
      }
      return s;
    });

    expect(await resolveUserWallet(client, OWNER)).toEqual({
      method: 'lightning_address',
      wallet_id: 'w-ln',
      lightning_address: 'me@ln',
    });
  });

  it('prefers the wallet the owner declared as on-chain over a stray address', async () => {
    // A Lightning-typed wallet can still carry an address field. Paying to it
    // because it happened to be first would ignore the owner's own declaration.
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-stray', wallet_type: 'lightning', address_or_xpub: 'bc1qstray' }),
        wallet({ id: 'w-declared', wallet_type: 'onchain', address_or_xpub: 'bc1qdeclared' }),
      ],
    });

    expect(await resolveUserWallet(client, OWNER)).toEqual({
      method: 'onchain',
      wallet_id: 'w-declared',
      onchain_address: 'bc1qdeclared',
    });
  });

  it('rejects an xpub as a payable address and carries the key instead', async () => {
    // Handing `bitcoin:zpub...` to a payer is a QR no wallet can pay; it shipped
    // once. The key must travel as onchain_xpub so an address is derived later.
    const zpub =
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-xpub', wallet_type: 'xpub', address_or_xpub: zpub }),
      ],
    });

    const resolved = await resolveUserWallet(client, OWNER);

    expect(resolved).toEqual({ method: 'onchain', wallet_id: 'w-xpub', onchain_xpub: zpub });
    expect(resolved).not.toHaveProperty('onchain_address');
  });
});

describe('resolveSpecificUserWallet — ownership is part of the query', () => {
  const rows = [
    wallet({ id: 'w-mine', lightning_address: 'mine@ln' }),
    wallet({ id: 'w-theirs', profile_id: STRANGER, lightning_address: 'theirs@ln' }),
    wallet({ id: 'w-dead', is_active: false, lightning_address: 'dead@ln' }),
  ];

  it('resolves the caller’s own wallet', async () => {
    const { client } = createFakeSupabase({ [DATABASE_TABLES.WALLETS]: rows });

    expect(await resolveSpecificUserWallet(client, OWNER, 'w-mine')).toEqual({
      method: 'lightning_address',
      wallet_id: 'w-mine',
      lightning_address: 'mine@ln',
    });
  });

  it('refuses a wallet id belonging to someone else', async () => {
    const { client } = createFakeSupabase({ [DATABASE_TABLES.WALLETS]: rows });

    expect(await resolveSpecificUserWallet(client, OWNER, 'w-theirs')).toBeNull();
  });

  it('refuses a deactivated wallet of the caller’s own', async () => {
    const { client } = createFakeSupabase({ [DATABASE_TABLES.WALLETS]: rows });

    expect(await resolveSpecificUserWallet(client, OWNER, 'w-dead')).toBeNull();
  });
});

describe('resolveSellerWallet — a wallet tied to one specific entity', () => {
  const product = getEntityMetadata('product');

  function linkedWorld(links: Row[], wallets: Row[]) {
    const fake = createFakeSupabase({
      [DATABASE_TABLES.ENTITY_WALLETS]: links,
      [product.tableName]: [{ id: 'prod-1', [product.userIdField]: 'actor-1' }],
      [DATABASE_TABLES.ACTORS]: [
        { id: 'actor-1', actor_type: 'user', user_id: OWNER, group_id: null },
      ],
      [DATABASE_TABLES.WALLETS]: wallets,
    });
    getAdminClientMock.mockReturnValue(fake.client);
    return fake;
  }

  it('ignores a link to a wallet the owner has since deactivated', async () => {
    linkedWorld(
      [{ entity_type: 'product', entity_id: 'prod-1', wallet_id: 'w-dead', is_primary: true }],
      [
        wallet({ id: 'w-dead', is_active: false, lightning_address: 'dead@ln' }),
        wallet({ id: 'w-default', is_primary: true, lightning_address: 'default@ln' }),
      ]
    );

    // Falls through to the owner's profile default rather than paying a wallet
    // that is no longer in use.
    expect(await resolveSellerWallet('product', 'prod-1')).toMatchObject({
      wallet_id: 'w-default',
    });
  });

  it('uses the link the owner marked primary when several are tied to the entity', async () => {
    linkedWorld(
      [
        // Non-primary listed first: only real ordering picks the right one.
        { entity_type: 'product', entity_id: 'prod-1', wallet_id: 'w-other', is_primary: false },
        { entity_type: 'product', entity_id: 'prod-1', wallet_id: 'w-chosen', is_primary: true },
      ],
      [
        wallet({ id: 'w-other', lightning_address: 'other@ln' }),
        wallet({ id: 'w-chosen', lightning_address: 'chosen@ln' }),
      ]
    );

    expect(await resolveSellerWallet('product', 'prod-1')).toMatchObject({
      wallet_id: 'w-chosen',
    });
  });

  it('does not borrow a wallet linked to a DIFFERENT entity', async () => {
    linkedWorld(
      [{ entity_type: 'product', entity_id: 'prod-2', wallet_id: 'w-theirs', is_primary: true }],
      [
        wallet({ id: 'w-theirs', lightning_address: 'other-entity@ln' }),
        wallet({ id: 'w-default', is_primary: true, lightning_address: 'default@ln' }),
      ]
    );

    expect(await resolveSellerWallet('product', 'prod-1')).toMatchObject({
      wallet_id: 'w-default',
    });
  });
});

describe('resolveSellerWallet — group entities', () => {
  const GROUP = 'group-1';

  function groupWallet(over: Row): Row {
    return {
      id: 'gw',
      group_id: GROUP,
      is_active: true,
      lightning_address: null,
      bitcoin_address: null,
      created_at: '2026-01-01',
      ...over,
    };
  }

  it('pays the group’s own wallet, never another group’s', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.ENTITY_WALLETS]: [],
      [DATABASE_TABLES.GROUP_WALLETS]: [
        groupWallet({ id: 'gw-other', group_id: 'group-2', lightning_address: 'other@ln' }),
        groupWallet({ id: 'gw-ours', lightning_address: 'ours@ln' }),
      ],
    });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerWallet('group', GROUP)).toEqual({
      method: 'lightning_address',
      wallet_id: 'gw-ours',
      lightning_address: 'ours@ln',
    });
  });

  it('ignores deactivated group wallets', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.ENTITY_WALLETS]: [],
      [DATABASE_TABLES.GROUP_WALLETS]: [
        groupWallet({ id: 'gw-dead', is_active: false, lightning_address: 'dead@ln' }),
        groupWallet({ id: 'gw-live', bitcoin_address: 'bc1qlive' }),
      ],
    });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerWallet('group', GROUP)).toEqual({
      method: 'onchain',
      wallet_id: 'gw-live',
      onchain_address: 'bc1qlive',
    });
  });

  it('routes a group-OWNED entity to the group treasury, not the founder’s pocket', async () => {
    // The entity is a product owned by a group actor. `groups.created_by` is
    // also the ownership field, so a wrong branch here quietly pays club income
    // into the founder's personal wallet.
    const product = getEntityMetadata('product');
    const fake = createFakeSupabase({
      [DATABASE_TABLES.ENTITY_WALLETS]: [],
      [product.tableName]: [{ id: 'prod-1', [product.userIdField]: 'actor-g' }],
      [DATABASE_TABLES.ACTORS]: [
        { id: 'actor-g', actor_type: 'group', user_id: 'founder-1', group_id: GROUP },
      ],
      [DATABASE_TABLES.WALLETS]: [
        wallet({ id: 'w-founder', profile_id: 'founder-1', lightning_address: 'founder@ln' }),
      ],
      [DATABASE_TABLES.GROUP_WALLETS]: [
        groupWallet({ id: 'gw-ours', lightning_address: 'ours@ln' }),
      ],
    });
    getAdminClientMock.mockReturnValue(fake.client);

    expect(await resolveSellerWallet('product', 'prod-1')).toEqual({
      method: 'lightning_address',
      wallet_id: 'gw-ours',
      lightning_address: 'ours@ln',
    });
  });

  it('picks the group’s oldest wallet when several could receive', async () => {
    // group_wallets has no is_primary, so age is the whole tie-break. Without a
    // deterministic order, two equally capable treasury wallets would receive
    // in whatever order Postgres happened to return them.
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.ENTITY_WALLETS]: [],
      [DATABASE_TABLES.GROUP_WALLETS]: [
        groupWallet({ id: 'gw-new', lightning_address: 'new@ln', created_at: '2026-06-01' }),
        groupWallet({ id: 'gw-old', lightning_address: 'old@ln', created_at: '2026-01-01' }),
      ],
    });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerWallet('group', GROUP)).toMatchObject({
      wallet_id: 'gw-old',
    });
  });

  it('returns null when the group has wallets but none can receive', async () => {
    const { client } = createFakeSupabase({
      [DATABASE_TABLES.ENTITY_WALLETS]: [],
      [DATABASE_TABLES.GROUP_WALLETS]: [groupWallet({ id: 'gw-empty' })],
    });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerWallet('group', GROUP)).toBeNull();
  });
});
