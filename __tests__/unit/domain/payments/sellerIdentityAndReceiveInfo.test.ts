/**
 * The two wallet-resolution exports that had no tests at all.
 *
 * `resolveSellerReceiveInfo` is what the owner is SHOWN as their receiving
 * address; `getSellerUserId` is who gets credited and notified when money
 * arrives. Both were fully unconstrained — every mutant survived — which means
 * showing the wrong address, or paying the wrong person's ledger, was a silent
 * change.
 *
 * The property worth pinning for receive-info is that it is derived from the
 * same resolution the payment uses: what the owner reads off the screen must be
 * where the money would actually land. And that it never leaks the NWC secret.
 */

import {
  resolveSellerReceiveInfo,
  getSellerUserId,
  materializeOnchainAddress,
} from '@/domain/payments/walletResolutionService';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata } from '@/config/entity-registry';
import { createFakeSupabase, type Row } from '../../../../test-utils/fakeSupabase';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/payments/encryptionService', () => ({ decrypt: (s: string) => s }));

import { getAdminClient } from '@/lib/supabase/admin';
import type { Mock } from 'vitest';

const getAdminClientMock = getAdminClient as Mock;

const PRODUCT = getEntityMetadata('product');
const ENTITY_ID = 'prod-1';
const ACTOR = 'actor-1';
const OWNER = 'user-1';

function world(over: { wallets?: Row[]; actor?: Row | null; entity?: Row | null } = {}) {
  return createFakeSupabase({
    [DATABASE_TABLES.ENTITY_WALLETS]: [],
    [PRODUCT.tableName]:
      over.entity === null ? [] : [over.entity ?? { id: ENTITY_ID, [PRODUCT.userIdField]: ACTOR }],
    [DATABASE_TABLES.ACTORS]:
      over.actor === null
        ? []
        : [over.actor ?? { id: ACTOR, actor_type: 'user', user_id: OWNER, group_id: null }],
    [DATABASE_TABLES.WALLETS]: over.wallets ?? [],
  });
}

function wallet(over: Row): Row {
  return {
    id: 'w-1',
    profile_id: OWNER,
    is_active: true,
    is_primary: true,
    wallet_type: 'onchain',
    nwc_connection_uri: null,
    lightning_address: null,
    address_or_xpub: null,
    created_at: '2026-01-01',
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('resolveSellerReceiveInfo — what the owner is shown', () => {
  it('shows the Lightning address that would receive the payment', async () => {
    const { client } = world({ wallets: [wallet({ lightning_address: 'me@orangecat.ch' })] });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerReceiveInfo('product', ENTITY_ID)).toEqual({
      method: 'lightning_address',
      address: 'me@orangecat.ch',
    });
  });

  it('shows the on-chain address that would receive the payment', async () => {
    const { client } = world({ wallets: [wallet({ address_or_xpub: 'bc1qexample' })] });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerReceiveInfo('product', ENTITY_ID)).toEqual({
      method: 'onchain',
      address: 'bc1qexample',
    });
  });

  it('never renders an NWC connection as an address — a connection has none', async () => {
    // Leaking this string would publish the owner's wallet credential.
    const secret = 'nostr+walletconnect://pubkey?relay=wss://r&secret=hunter2';
    const { client } = world({ wallets: [wallet({ nwc_connection_uri: secret })] });
    getAdminClientMock.mockReturnValue(client);

    const info = await resolveSellerReceiveInfo('product', ENTITY_ID);

    expect(info).toEqual({ method: 'nwc', address: null });
    expect(JSON.stringify(info)).not.toContain('hunter2');
  });

  it('shows nothing rather than a guess when an xpub has no address yet', async () => {
    // Derivation happens at invoice time, so there is no address to display —
    // and the xpub itself must never be shown as one.
    const zpub =
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
    const { client } = world({ wallets: [wallet({ wallet_type: 'xpub', address_or_xpub: zpub })] });
    getAdminClientMock.mockReturnValue(client);

    const info = await resolveSellerReceiveInfo('product', ENTITY_ID);

    expect(info).toEqual({ method: 'onchain', address: null });
  });

  it('returns null when no wallet is connected', async () => {
    const { client } = world({ wallets: [] });
    getAdminClientMock.mockReturnValue(client);

    expect(await resolveSellerReceiveInfo('product', ENTITY_ID)).toBeNull();
  });
});

describe('getSellerUserId — who gets credited', () => {
  it('returns the owning user for a user actor', async () => {
    const { client } = world();
    getAdminClientMock.mockReturnValue(client);

    expect(await getSellerUserId({} as never, 'product', ENTITY_ID)).toBe(OWNER);
  });

  it('returns the group founder for a group actor', async () => {
    const fake = createFakeSupabase({
      [PRODUCT.tableName]: [{ id: ENTITY_ID, [PRODUCT.userIdField]: ACTOR }],
      [DATABASE_TABLES.ACTORS]: [
        { id: ACTOR, actor_type: 'group', user_id: null, group_id: 'group-1' },
      ],
      [DATABASE_TABLES.GROUPS]: [
        { id: 'group-other', created_by: 'wrong-founder' },
        { id: 'group-1', created_by: 'founder-1' },
      ],
    });
    getAdminClientMock.mockReturnValue(fake.client);

    expect(await getSellerUserId({} as never, 'product', ENTITY_ID)).toBe('founder-1');
  });

  it('returns null for a group actor with no group_id rather than guessing', async () => {
    const { client } = world({
      actor: { id: ACTOR, actor_type: 'group', user_id: 'someone', group_id: null },
    });
    getAdminClientMock.mockReturnValue(client);

    // user_id is populated here: a sloppy fallback would return 'someone' and
    // credit an individual for a group's income.
    expect(await getSellerUserId({} as never, 'product', ENTITY_ID)).toBeNull();
  });

  it('returns null when the entity does not exist', async () => {
    const { client } = world({ entity: null });
    getAdminClientMock.mockReturnValue(client);

    expect(await getSellerUserId({} as never, 'product', ENTITY_ID)).toBeNull();
  });

  it('returns null when the actor record is missing', async () => {
    const { client } = world({ actor: null });
    getAdminClientMock.mockReturnValue(client);

    expect(await getSellerUserId({} as never, 'product', ENTITY_ID)).toBeNull();
  });
});

describe('materializeOnchainAddress — an invoice must never be minted without one', () => {
  const zpub =
    'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

  it('passes through a wallet that already has a concrete address', async () => {
    const { client } = createFakeSupabase({});
    getAdminClientMock.mockReturnValue(client);
    const already = {
      method: 'onchain' as const,
      wallet_id: 'w-1',
      onchain_address: 'bc1qalready',
    };

    expect(await materializeOnchainAddress(already)).toBe(already);
  });

  it('leaves non-on-chain wallets untouched', async () => {
    const lightning = {
      method: 'lightning_address' as const,
      wallet_id: 'w-1',
      lightning_address: 'me@ln',
    };

    expect(await materializeOnchainAddress(lightning)).toBe(lightning);
  });

  it('derives at the index the database allocated, not always the first one', async () => {
    // BIP84 spec vectors: index 0 and index 1 are known, distinct addresses.
    // Ignoring the allocated index would hand every payer address 0 — the exact
    // reuse that caused the false-settle incident.
    const fake = createFakeSupabase({}, { rpc: { allocate_derivation_index: { data: 1 } } });
    getAdminClientMock.mockReturnValue(fake.client);

    const resolved = await materializeOnchainAddress({
      method: 'onchain',
      wallet_id: 'w-1',
      onchain_xpub: zpub,
    });

    expect(fake.rpcs).toEqual([{ fn: 'allocate_derivation_index', args: { p_wallet_id: 'w-1' } }]);
    expect(resolved.onchain_address).toBe('bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
    expect(resolved.onchain_address).not.toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    // The key stays on the resolution; only the address is added.
    expect(resolved.onchain_xpub).toBe(zpub);
  });

  it('throws when the index cannot be allocated rather than reusing address 0', async () => {
    const fake = createFakeSupabase(
      {},
      { rpc: { allocate_derivation_index: { error: { message: 'locked' } } } }
    );
    getAdminClientMock.mockReturnValue(fake.client);

    await expect(
      materializeOnchainAddress({ method: 'onchain', wallet_id: 'w-1', onchain_xpub: zpub })
    ).rejects.toThrow('Failed to allocate a receiving address');
  });

  it('throws when the allocator returns something that is not an index', async () => {
    const fake = createFakeSupabase({}, { rpc: { allocate_derivation_index: { data: null } } });
    getAdminClientMock.mockReturnValue(fake.client);

    await expect(
      materializeOnchainAddress({ method: 'onchain', wallet_id: 'w-1', onchain_xpub: zpub })
    ).rejects.toThrow('Failed to allocate a receiving address');
  });

  it('throws when an on-chain wallet has neither an address nor a key', async () => {
    await expect(
      materializeOnchainAddress({ method: 'onchain', wallet_id: 'w-1' })
    ).rejects.toThrow('neither an address nor an extended public key');
  });
});
