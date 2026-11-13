// @vitest-environment jsdom
/**
 * A request is paid into the requester's wallet. With none, the form used to
 * let them ask anyway, and the payer met "hasn't added a Bitcoin wallet yet"
 * (full-path review 2026-11-13, money#3). The screen now says so and offers
 * one tap to set up receiving; the server refuses the same case.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { RequestsScreen } from '@/components/requests/RequestsScreen';
import { REQUEST_COPY } from '@/config/payment-requests';
import { ROUTES } from '@/config/routes';

const receive = { hasWallet: false, loading: false };

vi.mock('next/navigation', () => ({
  usePathname: () => '/requests',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'me' }, isLoading: false }),
}));
vi.mock('@/hooks/useSellerPaymentMethods', () => ({
  useSellerPaymentMethods: () => receive,
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (n: number) => `${n} BTC` }),
}));
vi.mock('@/hooks/usePeopleFinder', () => ({
  usePeopleFinder: () => ({ people: [], loading: false }),
}));
vi.mock('@/components/send/useRecipientCheck', () => ({
  useRecipientCheck: () => ({ state: 'idle' }),
}));
vi.mock('@/services/payment-requests/request-client', () => ({
  fetchPaymentRequests: async () => ({ incoming: [], outgoing: [] }),
  createRequest: vi.fn(),
  closeRequest: vi.fn(),
}));

afterEach(cleanup);

describe('RequestsScreen', () => {
  it('without a wallet, offers to add one instead of the form', async () => {
    receive.hasWallet = false;
    render(<RequestsScreen />);
    expect(await screen.findByText(REQUEST_COPY.noWalletTitle)).toBeTruthy();
    const cta = screen.getByRole('link', { name: REQUEST_COPY.noWalletCta });
    expect(cta.getAttribute('href')).toBe(ROUTES.RECEIVE);
    expect(screen.queryByRole('button', { name: REQUEST_COPY.submit })).toBeNull();
    // What was asked of them is still in reach.
    expect(screen.getByText(REQUEST_COPY.incomingTitle)).toBeTruthy();
  });

  it('with a wallet, shows the form', async () => {
    receive.hasWallet = true;
    render(<RequestsScreen />);
    expect(await screen.findByRole('button', { name: REQUEST_COPY.submit })).toBeTruthy();
    expect(screen.queryByText(REQUEST_COPY.noWalletTitle)).toBeNull();
  });
});
