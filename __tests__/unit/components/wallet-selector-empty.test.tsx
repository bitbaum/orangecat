// @vitest-environment jsdom
/**
 * Empty entity create must not ask for "Bitcoin Address" and "Lightning Address".
 * Those columns are not what the pay page reads. The paste saves a wallet row.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { id: '11111111-1111-4111-8111-111111111111' } }),
}));

import { WalletSelectorField } from '@/components/create/wallet-selector/WalletSelectorField';

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

describe('WalletSelectorField destinations', () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it('offers one paste when the profile has no wallet', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      })
    );

    render(<WalletSelectorField formData={{}} onFieldChange={() => undefined} />);

    expect(await screen.findByText('Why do I need this?')).toBeTruthy();
    expect(screen.queryByText('Bitcoin Address')).toBeNull();
    expect(screen.queryByText('Lightning Address')).toBeNull();
    expect(screen.getByPlaceholderText('you@wallet.com or bc1…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });
});
