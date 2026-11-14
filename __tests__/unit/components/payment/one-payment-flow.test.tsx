// @vitest-environment jsdom
/**
 * One payment flow.
 *
 * Measured on orangecat.ch (2026-11-13): paying a person, supporting a
 * project, investing and buying a product were four implementations. One act
 * had five names ("Pay CHF 10.00", "Tip with a Bitcoin wallet", "Create
 * Bitcoin request", "Buy Now (CHF 20.00)", "Invest"); the waiting line was
 * "Waiting for the payment…" on /pay and "Waiting for payment..." in amber on a
 * project; a project's code had no way back; and the endings were a receipt,
 * "Support confirmed" and "Your order has been placed." with no order.
 * /pay is the model: its words and steps are now the only ones.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { PAY_COPY } from '@/config/pay';
import { TIP_COPY } from '@/config/tips';
import { PAY_STATE_WORDS } from '@/config/pay-words';
import {
  PAYMENT_FLOW_COPY,
  isBookedBeforePaid,
  payeeLine,
  receiptNote,
} from '@/config/payment-flow';
import { PublicPaymentProgress } from '@/components/payment/PublicPaymentProgress';
import { PaymentFlowSteps } from '@/components/payment/PaymentFlowSteps';
import { PublicSupportPanel } from '@/components/payment/PublicSupportPanel';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (btc: number) => `CHF ${(btc * 100_000).toFixed(2)}`,
    formatPrice: (n: number, c?: string) => `${c ?? 'BTC'} ${n.toFixed(2)}`,
    displayCurrency: 'CHF',
  }),
}));
vi.mock('@/components/payment/PaymentQRCode', () => ({
  PaymentQRCode: ({ amountBtc }: { amountBtc: number }) => (
    <div data-testid="code">{amountBtc}</div>
  ),
}));
vi.mock('@/lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('@/components/money/AmountField', () => ({ AmountField: () => null }));
vi.mock('@/components/money/useOpeningAmountBtc', () => ({
  useChosenAmountBtc: () => [0.0001, vi.fn()],
}));
const publicPayment = vi.fn();
vi.mock('@/hooks/usePublicPayment', () => ({ usePublicPayment: () => publicPayment() }));

const intent = (over: Record<string, unknown> = {}) => ({
  payment_intent: {
    id: 'pi-1',
    amount_btc: 0.0001,
    payment_method: 'nwc',
    status: 'invoice_ready',
    expires_at: null,
    can_acknowledge: false,
    ...over,
  },
  status_token: 't'.repeat(40),
  qr_data: 'LNBC1',
  method_label: 'Lightning',
  expires_in_seconds: 3600,
});

const payment = (phase: string, over: Record<string, unknown> = {}) => ({
  phase,
  intent: intent(),
  error: '',
  start: vi.fn(),
  acknowledge: vi.fn(),
  reset: vi.fn(),
  ...over,
});

describe('one vocabulary', () => {
  it('a state has one wording, whoever is being paid', () => {
    for (const key of Object.keys(PAY_STATE_WORDS) as Array<keyof typeof PAY_STATE_WORDS>) {
      expect(PAY_COPY[key]).toBe(PAY_STATE_WORDS[key]);
      expect(TIP_COPY[key]).toBe(PAY_STATE_WORDS[key]);
    }
    expect(PAYMENT_FLOW_COPY.waiting).toBe(PAY_COPY.scan);
    expect(PAYMENT_FLOW_COPY.changeAmount).toBe(PAY_COPY.again);
    expect(PAYMENT_FLOW_COPY.paidTitle).toBe(PAY_COPY.paidTitle);
    expect(PAYMENT_FLOW_COPY.expiredTitle).toBe(PAY_COPY.expiredTitle);
    expect(PAYMENT_FLOW_COPY.custody).toBe(PAY_COPY.disclaimer);
  });

  it('the action is the verb and the figure', () => {
    expect(PAYMENT_FLOW_COPY.action('pay', 'CHF 20.00')).toBe('Pay CHF 20.00');
    expect(PAYMENT_FLOW_COPY.action('support', 'CHF 10.00')).toBe('Support CHF 10.00');
    expect(PAYMENT_FLOW_COPY.action('invest', 'CHF 57.78')).toBe('Invest CHF 57.78');
    expect(PAY_COPY.payAmount('CHF 10.00')).toBe(PAYMENT_FLOW_COPY.action('pay', 'CHF 10.00'));
    expect(TIP_COPY.payAmount('CHF 5.00')).toBe(PAYMENT_FLOW_COPY.action('support', 'CHF 5.00'));
  });

  it('retires "Tip": the act is called what the profile calls it', () => {
    expect(JSON.stringify(TIP_COPY)).not.toMatch(/\btips?\b/i);
    expect(TIP_COPY.button).toBe('Support');
  });

  it('names the payee, then what it is for', () => {
    expect(payeeLine('Cato', 'Morning with Cat')).toBe(
      'You pay Cato directly for Morning with Cat.'
    );
    expect(payeeLine('Zurich Makers', 'Zurich Makers')).toBe('You pay Zurich Makers directly.');
    expect(payeeLine(null, 'Morning with Cat')).toBe(
      'You pay the owner directly for Morning with Cat.'
    );
    expect(receiptNote('Zurich Makers', 'Zurich Makers')).toBeNull();
    expect(receiptNote('Morning with Cat', 'Cato')).toBe('Morning with Cat');
  });

  it('a service is booked before it is paid; a product is not', () => {
    expect(isBookedBeforePaid('service')).toBe(true);
    expect(isBookedBeforePaid('product')).toBe(false);
    expect(isBookedBeforePaid('event')).toBe(false);
  });
});

describe('an account-free payment draws the shared steps', () => {
  it('waits in the same words as /pay and offers a way back from the code', () => {
    const p = payment('awaiting');
    render(<PublicPaymentProgress payment={p as never} confirmationNote="note" />);
    expect(screen.getByText(PAY_COPY.scan)).toBeTruthy();
    expect(screen.getByText(PAY_COPY.disclaimer)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: PAY_COPY.again }));
    expect(p.reset).toHaveBeenCalled();
    // A rail that proves payment never offers the payer's word.
    expect(screen.queryByRole('button', { name: PAYMENT_FLOW_COPY.iPaid })).toBeNull();
  });

  it('on a price the way back is "Back", not "Change amount"', () => {
    render(
      <PublicPaymentProgress
        payment={payment('awaiting') as never}
        confirmationNote="n"
        fixedAmount
      />
    );
    expect(screen.getByRole('button', { name: PAYMENT_FLOW_COPY.back })).toBeTruthy();
    expect(screen.queryByRole('button', { name: PAY_COPY.again })).toBeNull();
  });

  it('offers "I’ve paid" only where the rail cannot prove it, then stops showing the code', () => {
    const p = payment('awaiting', { intent: intent({ can_acknowledge: true }) });
    const { rerender } = render(
      <PublicPaymentProgress payment={p as never} confirmationNote="They confirm by hand." />
    );
    fireEvent.click(screen.getByRole('button', { name: PAYMENT_FLOW_COPY.iPaid }));
    expect(p.acknowledge).toHaveBeenCalled();

    rerender(
      <PublicPaymentProgress
        payment={payment('recipient_confirmation') as never}
        confirmationNote="They confirm by hand."
      />
    );
    expect(screen.getByText(PAYMENT_FLOW_COPY.claimedTitle)).toBeTruthy();
    expect(screen.getByText('They confirm by hand.')).toBeTruthy();
    // A code here would only invite a second payment.
    expect(screen.queryByTestId('code')).toBeNull();
  });

  it.each([
    ['expired', PAY_COPY.expiredTitle],
    ['error', PAYMENT_FLOW_COPY.failedTitle],
  ])('%s is its own ending with a fresh start', (phase, title) => {
    const p = payment(phase, { error: 'The wallet said no.' });
    render(<PublicPaymentProgress payment={p as never} confirmationNote="n" />);
    expect(screen.getByText(title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: PAYMENT_FLOW_COPY.again }));
    expect(p.reset).toHaveBeenCalled();
  });
});

describe('support and investment end on the receipt', () => {
  it('names the action "Support <amount>" and never "Create Bitcoin request"', () => {
    publicPayment.mockReturnValue(payment('choose', { intent: null }));
    render(
      <PublicSupportPanel
        entityType="project"
        entityId="p1"
        entityTitle="Solon"
        recipientName="Cato"
      />
    );
    expect(screen.getByRole('button', { name: 'Support CHF 10.00' })).toBeTruthy();
    expect(screen.queryByText(/Create Bitcoin request/)).toBeNull();
  });

  it('shows amount, To, For and When once paid', () => {
    publicPayment.mockReturnValue(payment('paid'));
    render(
      <PublicSupportPanel
        entityType="project"
        entityId="p1"
        entityTitle="Solon"
        recipientName="Cato"
      />
    );
    expect(screen.getByText(PAY_COPY.paidTitle)).toBeTruthy();
    // The figure is drawn as number + currency (MoneyFigure).
    expect(screen.getByText('10.00')).toBeTruthy();
    expect(screen.getByText('To')).toBeTruthy();
    expect(screen.getByText('Cato')).toBeTruthy();
    expect(screen.getByText('For')).toBeTruthy();
    expect(screen.getByText('Solon')).toBeTruthy();
    expect(screen.queryByText(/Support confirmed/)).toBeNull();
  });

  it('an investor without an account is told again to keep the confirmation', () => {
    publicPayment.mockReturnValue(payment('paid'));
    render(
      <PublicSupportPanel
        entityType="investment"
        entityId="i1"
        entityTitle="Loki"
        recipientName="Cato"
      />
    );
    expect(screen.getByText(/Keep your payment confirmation/)).toBeTruthy();
  });
});

describe('a signed-in payment draws the same steps', () => {
  const data = {
    payment_intent: {
      id: 'pi-1',
      amount_btc: 0.0002,
      payment_method: 'nwc',
      lnurl_verify_url: null,
    },
    qr_data: 'LNBC1',
    method_label: 'Lightning',
    expires_in_seconds: 3600,
  };
  const flow = (state: Record<string, unknown>) => ({
    state,
    confirmPaid: vi.fn(),
    reset: vi.fn(),
  });

  it('the code has the same waiting line and a way back', () => {
    const f = flow({ phase: 'awaiting_payment', data });
    render(<PaymentFlowSteps flow={f as never} fixedAmount />);
    expect(screen.getByText(PAY_COPY.scan)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: PAYMENT_FLOW_COPY.back }));
    expect(f.reset).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: PAYMENT_FLOW_COPY.iPaid })).toBeNull();
  });

  it('a bare Lightning address is the one rail with "I’ve paid"', () => {
    const f = flow({
      phase: 'awaiting_payment',
      data: {
        ...data,
        payment_intent: { ...data.payment_intent, payment_method: 'lightning_address' },
      },
    });
    render(<PaymentFlowSteps flow={f as never} fixedAmount={false} />);
    fireEvent.click(screen.getByRole('button', { name: PAYMENT_FLOW_COPY.iPaid }));
    expect(f.confirmPaid).toHaveBeenCalled();
  });

  it('a purchase ends on the receipt, with its actions', () => {
    render(
      <PaymentFlowSteps
        flow={flow({ phase: 'success', data }) as never}
        fixedAmount
        payeeName="Cato"
        forWhat="Morning with Cat"
      >
        <a href="/dashboard/orders">{PAYMENT_FLOW_COPY.seeOrder}</a>
      </PaymentFlowSteps>
    );
    expect(screen.getByText(PAY_COPY.paidTitle)).toBeTruthy();
    expect(screen.getByText('20.00')).toBeTruthy();
    expect(screen.getByText('Cato')).toBeTruthy();
    expect(screen.getByText('Morning with Cat')).toBeTruthy();
    expect(screen.getByRole('link', { name: PAYMENT_FLOW_COPY.seeOrder })).toBeTruthy();
    expect(screen.queryByText(/Payment successful/)).toBeNull();
  });

  it('a claim is not a receipt', () => {
    render(<PaymentFlowSteps flow={flow({ phase: 'claimed', data }) as never} fixedAmount />);
    expect(screen.getByText(PAYMENT_FLOW_COPY.claimedTitle)).toBeTruthy();
    expect(screen.queryByText(PAY_COPY.paidTitle)).toBeNull();
  });
});
