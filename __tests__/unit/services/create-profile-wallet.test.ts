import { createProfileWallet } from '@/services/wallets/createProfileWallet';
import type { WalletFormData } from '@/types/wallet';

const profileId = '11111111-1111-4111-8111-111111111111';

const lightningPaste: WalletFormData = {
  label: '',
  lightning_address: 'ada@coinos.io',
  address_or_xpub: '',
  nwc_connection_uri: '',
  description: '',
  category: 'general',
  behavior_type: 'general',
};

describe('createProfileWallet', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts only the pasted handle and returns the saved wallet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          wallet: {
            id: 'wallet-1',
            lightning_address: 'ada@coinos.io',
            address_or_xpub: null,
            is_primary: true,
          },
        },
      }),
    });

    const wallet = await createProfileWallet(profileId, lightningPaste);

    expect(wallet.id).toBe('wallet-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/wallets');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.profile_id).toBe(profileId);
    expect(body.lightning_address).toBe('ada@coinos.io');
    expect(body.label).toBe('Main');
    expect(body).not.toHaveProperty('address_or_xpub');
    expect(body).not.toHaveProperty('nwc_connection_uri');
    expect(init.method).toBe('POST');
  });

  it('surfaces the API error instead of claiming the destination was saved', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'That address is not valid.' },
      }),
    });

    await expect(createProfileWallet(profileId, lightningPaste)).rejects.toThrow(
      'That address is not valid.'
    );
  });
});
