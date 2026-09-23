// @vitest-environment jsdom
/**
 * Receive is one screen: a pay link, an in-person code, and a one-amount code.
 * It must not grow a second tab bar that says "Request" — that word is the
 * other money page, where you ask a named account.
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
    arrivesAt: 'a@wallet.example',
  }),
  fetchReceiveWallets: async () => [],
  createReceiveRequest: async () => {
    throw new Error('not used');
  },
  fetchReceiveStatus: async () => ({ status: 'pending' }),
}));

import { ReceiveScreen } from '@/components/receive/ReceiveScreen';

describe('ReceiveScreen', () => {
  it('shows the pay link and an in-person code without a second tab bar', async () => {
    render(<ReceiveScreen />);

    expect(await screen.findByText('Your pay link')).toBeTruthy();
    expect(screen.getByText('catomean@orangecat.ch')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(screen.getByText(/old name still pays/i)).toBeTruthy();
    expect(screen.getByText(/Payments arrive at a@wallet.example/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'One amount' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Request amount' })).toBeNull();
    expect(screen.queryByText('Request amount')).toBeNull();
    expect(screen.queryByText('Send someone a payment link')).toBeNull();
    expect(screen.getByRole('link', { name: 'Request' })).toBeTruthy();
  });
});
