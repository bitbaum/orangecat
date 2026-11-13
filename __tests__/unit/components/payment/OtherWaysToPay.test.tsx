// @vitest-environment jsdom
/**
 * "Ask" on a way to pay shared on request opens a message. Signed out, it used
 * to drop the payer on "Welcome back" with an empty composer behind it; now
 * the row says an account is needed, the button goes to registration, and the
 * conversation opens with the question already typed.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { OtherWaysToPay } from '@/components/payment/OtherWaysToPay';
import { PAYMENT_METHODS_COPY } from '@/config/payment-methods';
import { ROUTES } from '@/config/routes';
import { isMessageDraftKey } from '@/config/message-drafts';

let mockUser: { id: string } | null = null;
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, hydrated: true }),
}));
vi.mock('@/hooks/useUserCurrency', () => ({ useUserCurrency: () => 'CHF' }));
vi.mock('@/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({ convertFromBTC: (btc: number) => btc * 100_000 }),
}));

afterEach(cleanup);

const METHODS = [
  {
    id: 'm1',
    method: 'twint' as const,
    handle: null,
    label: null,
    visibility: 'on_request' as const,
  },
];

function renderWays() {
  render(
    <OtherWaysToPay
      recipientName="Cato"
      recipientId="p1"
      methods={METHODS}
      amountBtc={0}
      afterBitcoin
    />
  );
}

describe('Ask on a way to pay shared on request', () => {
  it('signed in: opens the conversation with the question typed', () => {
    mockUser = { id: 'u1' };
    renderWays();
    const ask = screen.getByRole('link', { name: PAYMENT_METHODS_COPY.ask });
    expect(ask.getAttribute('href')).toBe(ROUTES.MESSAGES_TO('p1', 'ask-payment-details'));
    expect(isMessageDraftKey('ask-payment-details')).toBe(true);
  });

  it('signed out: says an account is needed and goes to registration, back to the same draft', () => {
    mockUser = null;
    renderWays();
    expect(screen.getByText(PAYMENT_METHODS_COPY.sharedOnRequestSignedOut('Cato'))).toBeTruthy();
    const href = screen.getByRole('link', { name: PAYMENT_METHODS_COPY.ask }).getAttribute('href');
    expect(href).toBe(
      `${ROUTES.AUTH}?mode=register&from=${encodeURIComponent(ROUTES.MESSAGES_TO('p1', 'ask-payment-details'))}`
    );
  });
});
