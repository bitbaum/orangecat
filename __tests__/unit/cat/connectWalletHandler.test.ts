/**
 * `connect_wallet` is the Cat's answer to "I want to get paid".
 *
 * Measured in production 2026-08-06: 3 of 76 profiles could receive anything.
 * The Cat's context already said "no lightning address configured" — it just
 * had no verb that ended with a payable user, so it handed out a Settings link.
 *
 * Two properties matter more than the write itself, and both are pinned here:
 *
 *  1. **It never claims the user can be paid on the strength of an INSERT.**
 *     The confirmation comes from getOwnerReceiveStatus — the same resolution a
 *     payer's request runs. A stored value the payment path cannot use (an NWC
 *     URI this deployment cannot decrypt, say) is precisely the divergence
 *     receiveStatus.ts exists to prevent.
 *  2. **A spending credential is never stored in the clear.** An NWC URI can
 *     drain a wallet; if encryption is unavailable the action refuses instead of
 *     writing plaintext.
 */

import { paymentHandlers } from '@/services/cat/handlers/payments';
import { getOwnerReceiveStatus } from '@/domain/wallets/receiveStatus';
import { encrypt, isEncryptionConfigured } from '@/domain/payments/encryptionService';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/wallets/receiveStatus', () => ({ getOwnerReceiveStatus: vi.fn() }));
vi.mock('@/domain/payments/encryptionService', () => ({
  // Opaque on purpose: an `enc:${plaintext}` stub would contain the secret and
  // make the "never stored in the clear" assertion below vacuous.
  encrypt: vi.fn(() => 'ciphertext-blob'),
  isEncryptionConfigured: vi.fn(() => true),
}));
vi.mock('@/domain/payments/sendPaymentService', () => ({
  sendToRecipient: vi.fn(),
  resolveSenderNwcUri: vi.fn(),
}));

const receiveStatusMock = getOwnerReceiveStatus as Mock;
const encryptMock = encrypt as Mock;
const encryptionConfiguredMock = isEncryptionConfigured as Mock;

/** Captures what the handler tried to write, without a real Supabase. */
function makeSupabase(existingWallet: { id: string; label: string } | null) {
  const writes: Array<{ op: 'update' | 'insert'; id?: string; values: Record<string, unknown> }> =
    [];
  const supabase = {
    from: () => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: self,
        eq: self,
        order: self,
        limit: () => Promise.resolve({ data: existingWallet ? [existingWallet] : [] }),
        insert: (values: Record<string, unknown>) => {
          writes.push({ op: 'insert', values });
          return Promise.resolve({ error: null });
        },
        update: (values: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            writes.push({ op: 'update', id, values });
            return Promise.resolve({ error: null });
          },
        }),
      });
      return chain;
    },
  };
  return { supabase: supabase as never, writes };
}

const connect = (
  params: Record<string, unknown>,
  existing: { id: string; label: string } | null = null
) => {
  const { supabase, writes } = makeSupabase(existing);
  return paymentHandlers
    .connect_wallet(supabase, 'user-1', 'actor-1', params)
    .then(result => ({ result, writes }));
};

beforeEach(() => {
  vi.clearAllMocks();
  encryptionConfiguredMock.mockReturnValue(true);
  encryptMock.mockReturnValue('ciphertext-blob');
  receiveStatusMock.mockResolvedValue({
    rail: 'lightning',
    lightningAddressActive: true,
    unusableConnectionWalletIds: [],
  });
});

describe('cat connect_wallet routes whatever the user pasted', () => {
  it('stores a Lightning address and confirms the address is live', async () => {
    const { result, writes } = await connect({ wallet_string: 'me@primal.net' });

    expect(writes).toEqual([
      { op: 'insert', values: expect.objectContaining({ lightning_address: 'me@primal.net' }) },
    ]);
    expect(result.success).toBe(true);
    expect((result.data as { rail: string }).rail).toBe('lightning');
    expect((result.data as { displayMessage: string }).displayMessage).toContain('can now be paid');
  });

  it('stores an on-chain address without touching the lightning field', async () => {
    const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const { writes } = await connect({ wallet_string: address });

    expect(writes[0].values).toMatchObject({ address_or_xpub: address });
    expect(writes[0].values).not.toHaveProperty('lightning_address');
  });

  it('attaches to the wallet a payer already resolves to instead of creating a rival', async () => {
    const { writes } = await connect(
      { wallet_string: 'me@coinos.io' },
      {
        id: 'wallet-9',
        label: 'Rent',
      }
    );

    expect(writes).toEqual([
      { op: 'update', id: 'wallet-9', values: { lightning_address: 'me@coinos.io' } },
    ]);
  });

  it('rejects a string that is not a wallet at all, rather than storing junk', async () => {
    const { result, writes } = await connect({ wallet_string: 'my bank account' });

    expect(result.success).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe('cat connect_wallet protects the spending credential', () => {
  const NWC = 'nostr+walletconnect://abc?relay=wss://relay.example&secret=deadbeef';

  it('encrypts an NWC connection before it reaches the database', async () => {
    const { writes } = await connect({ wallet_string: NWC });

    expect(encryptMock).toHaveBeenCalledWith(NWC);
    expect(writes[0].values).toMatchObject({ nwc_connection_uri: 'ciphertext-blob' });
    expect(JSON.stringify(writes)).not.toContain('secret=deadbeef');
  });

  it('refuses the connection outright when encryption is unavailable', async () => {
    encryptionConfiguredMock.mockReturnValue(false);

    const { result, writes } = await connect({ wallet_string: NWC });

    expect(result.success).toBe(false);
    expect(writes).toEqual([]);
    expect(encryptMock).not.toHaveBeenCalled();
  });
});

describe('cat connect_wallet tells the truth about whether money can arrive', () => {
  it('does not claim success-to-receive when the payment path still resolves nothing', async () => {
    receiveStatusMock.mockResolvedValue({
      rail: null,
      lightningAddressActive: false,
      unusableConnectionWalletIds: [],
    });

    const { result } = await connect({ wallet_string: 'me@primal.net' });
    const message = (result.data as { displayMessage: string }).displayMessage;

    // The row was written, so this is not a failure — but the user must not be
    // told they are payable when a payer would still get nothing.
    expect(result.success).toBe(true);
    expect((result.data as { rail: string | null }).rail).toBeNull();
    expect(message).not.toContain('can now be paid');
    expect(message).toMatch(/do not resolve|not yet working/i);
  });

  it('only advertises the @orangecat.ch address when LNURL would actually serve it', async () => {
    receiveStatusMock.mockResolvedValue({
      rail: 'onchain',
      lightningAddressActive: false,
      unusableConnectionWalletIds: [],
    });

    const { result } = await connect({
      wallet_string: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    });

    expect((result.data as { displayMessage: string }).displayMessage).not.toContain(
      'orangecat.ch'
    );
  });
});
