/**
 * Editing a wallet's payment handle must actually change it.
 *
 * Regression guard for a silent no-op: `walletUpdateSchema` omitted
 * `lightning_address` and `nwc_connection_uri`, so Zod stripped them and PATCH
 * answered 200 while the stored handle was untouched. A user could never
 * correct a wrong Lightning address or replace a broken wallet connection —
 * and the UI told them to do exactly that.
 */

import { walletUpdateSchema } from '@/lib/validation/finance';
import { buildWalletUpdates } from '@/domain/wallets/updateWallet';
import { encrypt } from '@/domain/payments/encryptionService';

vi.mock('@/domain/payments/encryptionService', () => ({
  encrypt: vi.fn((plaintext: string) => `encrypted:${plaintext}`),
}));

type Parsed = ReturnType<typeof walletUpdateSchema.parse>;

/** Parse like the route does — this is where the fields used to disappear. */
function parse(body: Record<string, unknown>): Parsed {
  const result = walletUpdateSchema.safeParse(body);
  if (!result.success) {
    throw new Error(`schema rejected: ${result.error.issues[0]?.message}`);
  }
  return result.data;
}

describe('wallet update — payment handles survive the schema', () => {
  it('keeps lightning_address instead of stripping it', () => {
    expect(parse({ lightning_address: 'me@wallet.com' })).toHaveProperty(
      'lightning_address',
      'me@wallet.com'
    );
  });

  it('keeps nwc_connection_uri instead of stripping it', () => {
    const uri = 'nostr+walletconnect://abc?relay=wss://r.example';
    expect(parse({ nwc_connection_uri: uri })).toHaveProperty('nwc_connection_uri', uri);
  });
});

describe('buildWalletUpdates', () => {
  it('writes a corrected Lightning address and marks the rail', () => {
    const { updates, error } = buildWalletUpdates(parse({ lightning_address: 'me@wallet.com' }));
    expect(error).toBeNull();
    expect(updates).toMatchObject({ lightning_address: 'me@wallet.com', wallet_type: 'lightning' });
  });

  it('rejects a malformed Lightning address instead of storing it', () => {
    const { updates, error } = buildWalletUpdates(parse({ lightning_address: 'not-an-address' }));
    expect(updates).toBeNull();
    expect(error).not.toBeNull();
  });

  it('encrypts a replacement connection — never stores the raw secret', () => {
    const uri = 'nostr+walletconnect://abc?relay=wss://r.example';
    const { updates, error } = buildWalletUpdates(parse({ nwc_connection_uri: uri }));
    expect(error).toBeNull();
    // The stored value is whatever encrypt() produced, never the URI itself.
    expect(encrypt).toHaveBeenCalledWith(uri);
    expect(updates?.nwc_connection_uri).toBe(`encrypted:${uri}`);
    expect(updates?.nwc_connection_uri).not.toBe(uri);
  });

  it('rejects a connection string that is not an NWC URI', () => {
    const { updates, error } = buildWalletUpdates(
      parse({ nwc_connection_uri: 'https://evil.example' })
    );
    expect(updates).toBeNull();
    expect(error).not.toBeNull();
  });

  it('clears a handle when the form sends an empty value', () => {
    const { updates, error } = buildWalletUpdates(
      parse({ lightning_address: '', address_or_xpub: '' })
    );
    expect(error).toBeNull();
    expect(updates).toMatchObject({ lightning_address: null, address_or_xpub: null });
  });

  it('leaves handles untouched when the payload omits them (label-only edit)', () => {
    const { updates, error } = buildWalletUpdates(parse({ label: 'Renamed' }));
    expect(error).toBeNull();
    expect(updates).not.toHaveProperty('lightning_address');
    expect(updates).not.toHaveProperty('nwc_connection_uri');
    expect(updates).not.toHaveProperty('address_or_xpub');
  });
});
