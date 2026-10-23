// @vitest-environment jsdom
/**
 * Receive opens on the code: who it pays, a QR of the pay link, the link,
 * Copy and Share as two equal cells. Under it, every way this account is
 * paid — Bitcoin first, the other apps after, "add" as the last row.
 * No invoice form, no wallet menu, no summary that looks like a button.
 */

import { fireEvent, render, screen } from '@testing-library/react';

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

// The live arrival of a payment. Null = nothing has arrived since the screen opened.
let arrived: { id: string; amountBtc: number; from: string | null; note: string | null } | null =
  null;
const dismissMock = vi.fn();
vi.mock('@/hooks/useIncomingPayment', () => ({
  useIncomingPayment: () => ({ payment: arrived, dismiss: dismissMock }),
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (n: number) => `${n} BTC` }),
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
      visibility: 'public',
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
    // The code says who you are; the amount is the payer's or Request's.
    expect(screen.queryByRole('button', { name: 'Add an amount' })).toBeNull();

    // The ways: Bitcoin first, then the others, then add.
    expect(screen.getByText('Ways to pay you')).toBeTruthy();
    expect(screen.getByText('Bitcoin')).toBeTruthy();
    expect(screen.getByText('catomean@orangecat.ch')).toBeTruthy();
    expect(screen.getByText(/Lands in orangecat@coinos.io/)).toBeTruthy();
    expect(screen.getByText('Twint')).toBeTruthy();
    expect(screen.getByText('+41791234567')).toBeTruthy();
    // The identity cost, in the same words on every row.
    expect(screen.getByText(/A payer learns only @catomean\./)).toBeTruthy();
    expect(
      screen.getByText(/On your page · A payer learns your name and your phone number\./)
    ).toBeTruthy();
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

  it('turns the code into a receipt when a payment arrives, and back on Done', async () => {
    arrived = { id: 'n1', amountBtc: 0.0002, from: 'Marco', note: 'dinner' };
    try {
      render(<ReceiveScreen />);

      expect(await screen.findByText('Received')).toBeTruthy();
      expect(screen.getByText('Marco')).toBeTruthy();
      expect(screen.getByText('dinner')).toBeTruthy();
      // The code is out of the way while the moment is on screen.
      expect(screen.queryByTitle('QR code to pay Cato')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(dismissMock).toHaveBeenCalled();
    } finally {
      arrived = null;
    }
  });
});
