// @vitest-environment jsdom
/**
 * Receive opens on the code: who it pays, a QR of the pay link, the link,
 * Copy and Share as two equal cells. Under it, every way this account is
 * paid — Bitcoin first, the other apps after, "add" as the last row.
 * No invoice form, no wallet menu, no summary that looks like a button.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', () => ({
  useRequireAuth: () => ({
    user: { id: '11111111-1111-4111-8111-111111111111' },
    profile: {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'catomean',
      name: 'Cato',
      avatar_url: null,
    },
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
}));

vi.mock('@/services/payment-methods/payment-methods-client', () => ({
  fetchPaymentMethods: async () => [
    {
      id: 'm1',
      method: 'twint',
      handle: '+41791234567',
      label: null,
      display_order: 0,
      is_active: true,
    },
  ],
  removePaymentMethod: async () => undefined,
  addPaymentMethod: async () => {
    throw new Error('not used');
  },
}));

import { ReceiveScreen } from '@/components/receive/ReceiveScreen';
import { walletAppUrl } from '@/config/receive';

describe('ReceiveScreen', () => {
  it('opens on a scannable code, then lists every way to be paid', async () => {
    render(<ReceiveScreen />);

    // The code, for the person it pays.
    expect(await screen.findByTitle('QR code to pay Cato')).toBeTruthy();
    expect(screen.getByText('Cato')).toBeTruthy();
    expect(screen.getByText('@catomean')).toBeTruthy();
    expect(screen.getByText(/\/pay\/catomean$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add an amount' })).toBeTruthy();

    // The ways: Bitcoin first, then the others, then add.
    expect(screen.getByText('Ways to pay you')).toBeTruthy();
    expect(screen.getByText('Bitcoin')).toBeTruthy();
    expect(screen.getByText('catomean@orangecat.ch')).toBeTruthy();
    expect(screen.getByText('Arrives at orangecat@coinos.io')).toBeTruthy();
    expect(screen.getByText('Twint')).toBeTruthy();
    expect(screen.getByText('+41791234567')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Twint' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a way to be paid' })).toBeTruthy();

    // What the old screen had and this one must not.
    expect(screen.queryByText('Where this goes')).toBeNull();
    expect(screen.queryByText('Receive with')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'One amount' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Request' })).toBeTruthy();
  });

  it('does not turn an unknown wallet host into a link', () => {
    expect(walletAppUrl('me@getalby.com')).toBeNull();
    expect(walletAppUrl('orangecat@coinos.io')).toBe('https://coinos.io');
  });
});
