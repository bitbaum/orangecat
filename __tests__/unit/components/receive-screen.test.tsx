// @vitest-environment jsdom
/**
 * Receive is the door you share: one link, the same name for a wallet app,
 * and where the money actually arrives. It does not mint an invoice or offer
 * a wallet menu. Request stays the other page.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', () => ({
  useRequireAuth: () => ({
    user: { id: '11111111-1111-4111-8111-111111111111' },
    profile: { id: '11111111-1111-4111-8111-111111111111' },
    isLoading: false,
  }),
}));

vi.mock('@/services/receive/receive-client', () => ({
  fetchReceiveOverview: async () => ({
    username: 'catomean',
    lightningAddress: 'catomean@orangecat.ch',
    rail: 'lightning_address',
    lightningAddressActive: true,
    arrivesAt: 'orangecat@coinos.io',
  }),
  fetchReceiveWallets: async () => [],
  createReceiveRequest: async () => {
    throw new Error('not used');
  },
  fetchReceiveStatus: async () => ({ status: 'pending' }),
}));

import { ReceiveScreen } from '@/components/receive/ReceiveScreen';
import { walletAppUrl } from '@/config/receive';

describe('ReceiveScreen', () => {
  it('shows the pay link and an in-person code without a second tab bar', async () => {
    render(<ReceiveScreen />);

    expect(await screen.findByText('Your pay link')).toBeTruthy();
    expect(screen.getByText('catomean@orangecat.ch')).toBeTruthy();
    expect(screen.getByText(/old name still pays/i)).toBeTruthy();
    const destination = screen.getByRole('link', { name: 'orangecat@coinos.io' });
    expect(destination.getAttribute('href')).toBe('https://coinos.io');
    expect(screen.queryByRole('heading', { name: 'One amount' })).toBeNull();
    expect(screen.queryByText('Receive with')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Request amount' })).toBeNull();
    expect(screen.queryByText('Request amount')).toBeNull();
    expect(screen.queryByText('Send someone a payment link')).toBeNull();
    expect(screen.getByRole('link', { name: 'Request' })).toBeTruthy();
  });

  it('does not turn an unknown wallet host into a link', () => {
    expect(walletAppUrl('me@getalby.com')).toBeNull();
    expect(walletAppUrl('orangecat@coinos.io')).toBe('https://coinos.io');
  });
});
