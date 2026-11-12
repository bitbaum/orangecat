// @vitest-environment jsdom
/**
 * The card an investment's "Review & invest" leads to takes the investment's
 * own terms.
 *
 * Production, 2026-11-12: the page said "Minimum Investment ₿0.001"; the card
 * said "Support with Bitcoin", opened at 0.0001 BTC (CHF 6.10) and suggested
 * CHF 5 / 10 / 20 / 50 — all below the minimum. Signed in, the dialog said
 * "Support … Choose an amount to support this investment". The amount field now
 * opens at the minimum and is bounded by the stated terms (which also drops the
 * suggestions outside them), and the words say what the payment is.
 */
import { render, screen } from '@testing-library/react';
import { PublicSupportPanel } from '@/components/payment/PublicSupportPanel';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { breachedBound, contributionRange } from '@/config/contribution-terms';
import { DEFAULT_CONTRIBUTION_BTC } from '@/config/payment-presets';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';

const amountFieldProps = vi.fn();
vi.mock('@/components/money/AmountField', () => ({
  AmountField: (props: { value: number; minBtc: number; maxBtc: number }) => {
    amountFieldProps(props);
    return null;
  },
}));
vi.mock('@/hooks/usePublicPayment', () => ({
  usePublicPayment: () => ({ phase: 'choose', start: vi.fn() }),
}));
vi.mock('@/components/payment/PublicPaymentProgress', () => ({
  PublicPaymentProgress: () => null,
}));
vi.mock('@/hooks/usePaymentFlow', () => ({
  usePaymentFlow: () => ({
    state: { phase: 'idle' },
    initiate: vi.fn(),
    confirmPaid: vi.fn(),
    reset: vi.fn(),
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (btc: number) => `${btc} BTC`,
    formatPrice: (n: number) => `${n}`,
  }),
}));

const TERMS = { minBtc: 0.001, maxBtc: 0.01 };
const lastAmountField = () => amountFieldProps.mock.calls.at(-1)?.[0];

beforeEach(() => amountFieldProps.mockClear());

describe('the investment card', () => {
  it('opens at the minimum, bounded by the stated terms, and says invest', () => {
    render(
      <PublicSupportPanel
        entityType="investment"
        entityId="inv-1"
        entityTitle="Loki"
        recipientName="Cato"
        bounds={TERMS}
      />
    );
    expect(lastAmountField()).toMatchObject({ value: 0.001, minBtc: 0.001, maxBtc: 0.01 });
    expect(screen.getByText('Invest with Bitcoin')).toBeTruthy();
    expect(
      screen.getByText(/You invest on the terms on this page and pay Cato directly/)
    ).toBeTruthy();
    expect(screen.getByText('Minimum 0.001 BTC · Maximum 0.01 BTC')).toBeTruthy();
    expect(screen.queryByText(/support/i)).toBeNull();
  });

  it('leaves other entities on the usual support card', () => {
    render(<PublicSupportPanel entityType="cause" entityId="c1" entityTitle="Remise Rosa" />);
    expect(lastAmountField()).toMatchObject({
      value: DEFAULT_CONTRIBUTION_BTC,
      minBtc: PAY_MIN_BTC,
      maxBtc: PAY_MAX_BTC,
    });
    expect(screen.getByText('Support with Bitcoin')).toBeTruthy();
  });
});

describe('the signed-in dialog', () => {
  it('opens at the minimum and invests rather than supports', () => {
    render(
      <PaymentDialog
        open
        onOpenChange={vi.fn()}
        entityType="investment"
        entityId="inv-1"
        entityTitle="Loki"
        contributionBounds={TERMS}
      />
    );
    expect(lastAmountField()).toMatchObject({ value: 0.001, minBtc: 0.001, maxBtc: 0.01 });
    expect(screen.getByText('Invest in Loki')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invest 0.001 BTC' })).toBeTruthy();
    expect(screen.queryByText(/support/i)).toBeNull();
  });
});

describe('contribution range', () => {
  it('opens at the nearest bound when the usual amount is outside the terms', () => {
    expect(contributionRange({ minBtc: 0.001, maxBtc: null }).defaultBtc).toBe(0.001);
    expect(contributionRange({ minBtc: null, maxBtc: 0.00005 }).defaultBtc).toBe(0.00005);
    expect(contributionRange({ minBtc: 0.00001, maxBtc: null }).defaultBtc).toBe(
      DEFAULT_CONTRIBUTION_BTC
    );
  });

  it('keeps the terms inside what a payment can be at all', () => {
    expect(contributionRange({ minBtc: null, maxBtc: 5 }).maxBtc).toBe(PAY_MAX_BTC);
    expect(contributionRange(null)).toEqual({
      minBtc: PAY_MIN_BTC,
      maxBtc: PAY_MAX_BTC,
      defaultBtc: DEFAULT_CONTRIBUTION_BTC,
    });
  });

  it('names the bound an amount breaks, within half a satoshi', () => {
    expect(breachedBound(0.0001, TERMS)).toBe('min');
    expect(breachedBound(0.02, TERMS)).toBe('max');
    expect(breachedBound(0.001 - 1e-12, TERMS)).toBeNull();
    expect(breachedBound(0.0001, null)).toBeNull();
  });
});
