/**
 * Owner receive status — the page's only allowed source of "can I be paid".
 *
 * Guards the exact production defect this module was written for: a stored NWC
 * connection this deployment cannot decrypt must NOT be reported as a working
 * Lightning setup, and the resulting on-chain fallback must be disclosed rather
 * than dressed up as a live Lightning address.
 */

import { getOwnerReceiveStatus } from '@/domain/wallets/receiveStatus';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import { canDecrypt } from '@/domain/payments/encryptionService';

import type { MockedFunction } from 'vitest';

vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveUserWallet: vi.fn(),
}));
vi.mock('@/domain/payments/encryptionService', () => ({
  canDecrypt: vi.fn(),
}));

const nwcRows: Array<{ id: string; nwc_connection_uri: string | null }> = [];

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: nwcRows, error: null }),
    }),
  }),
}));

const mockResolve = resolveUserWallet as MockedFunction<typeof resolveUserWallet>;
const mockCanDecrypt = canDecrypt as MockedFunction<typeof canDecrypt>;

beforeEach(() => {
  vi.clearAllMocks();
  nwcRows.length = 0;
  mockCanDecrypt.mockReturnValue(true);
});

describe('getOwnerReceiveStatus', () => {
  it('reports an active Lightning address for an NWC rail', async () => {
    mockResolve.mockResolvedValue({ method: 'nwc', wallet_id: 'w1', nwc_uri: 'nostr+wc://x' });
    await expect(getOwnerReceiveStatus('u1')).resolves.toEqual({
      rail: 'nwc',
      lightningAddressActive: true,
      unusableConnectionWalletIds: [],
    });
  });

  it('reports an active Lightning address for a lightning-address rail', async () => {
    mockResolve.mockResolvedValue({
      method: 'lightning_address',
      wallet_id: 'w1',
      lightning_address: 'a@b.c',
    });
    const status = await getOwnerReceiveStatus('u1');
    expect(status.lightningAddressActive).toBe(true);
  });

  it('does NOT claim a Lightning address when the rail is on-chain', async () => {
    mockResolve.mockResolvedValue({ method: 'onchain', wallet_id: 'w1', onchain_address: 'bc1x' });
    const status = await getOwnerReceiveStatus('u1');
    expect(status).toMatchObject({ rail: 'onchain', lightningAddressActive: false });
  });

  it('claims nothing when no wallet resolves', async () => {
    mockResolve.mockResolvedValue(null);
    await expect(getOwnerReceiveStatus('u1')).resolves.toMatchObject({
      rail: null,
      lightningAddressActive: false,
    });
  });

  it('flags a stored connection this deployment cannot decrypt', async () => {
    // The production case: an NWC row exists, but the key that encrypted it is
    // not present here, so resolveUserWallet silently degrades to on-chain.
    nwcRows.push({ id: 'w-nwc', nwc_connection_uri: 'ciphertext-from-another-key' });
    mockCanDecrypt.mockReturnValue(false);
    mockResolve.mockResolvedValue({ method: 'onchain', wallet_id: 'w2', onchain_address: 'bc1x' });

    const status = await getOwnerReceiveStatus('u1');

    expect(status.lightningAddressActive).toBe(false);
    expect(status.unusableConnectionWalletIds).toEqual(['w-nwc']);
  });

  it('fails closed when resolution throws — never claims a working rail', async () => {
    mockResolve.mockRejectedValue(new Error('db down'));
    await expect(getOwnerReceiveStatus('u1')).resolves.toMatchObject({
      rail: null,
      lightningAddressActive: false,
    });
  });
});
