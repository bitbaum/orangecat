// @vitest-environment jsdom
/**
 * Where a purchase and a booking are asked for.
 *
 * Measured on orangecat.ch (2026-11-13):
 *  - a signed-out buyer of a CHF 20 product met the seller's bare address
 *    ("orangecat@coinos.io") and "enter CHF 20.00 when prompted": no payee, no
 *    order, no receipt;
 *  - a service page offered "Book this" and, further down, "Buy Now
 *    (CHF 1,000.00)" — two paths that never met.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicEntityPaymentSection } from '@/components/payment/PublicEntityPaymentSection';
import { GuestPurchasePanel, GUEST_PURCHASE_COPY } from '@/components/payment/GuestPurchasePanel';
import { BookingPayCard, BOOKING_PAY_COPY } from '@/components/bookings/BookingPayCard';
import { PAYMENT_FLOW_COPY } from '@/config/payment-flow';
import { API_ROUTES } from '@/config/api-routes';
import { ACCOUNT_PURCHASE_COPY } from '@/config/account-bound-products';
import { PaymentFlowSteps } from '@/components/payment/PaymentFlowSteps';

let signedIn = false;
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: signedIn ? { id: 'viewer' } : null,
    isAuthenticated: signedIn,
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useSellerPaymentMethods', () => ({
  useSellerPaymentMethods: () => ({ hasWallet: true, loading: false }),
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (btc: number) => `CHF ${(btc * 100_000).toFixed(2)}`,
    formatPrice: (n: number, c?: string) => `${c ?? 'BTC'} ${n.toFixed(2)}`,
    displayCurrency: 'CHF',
  }),
}));
vi.mock('@/hooks/useDisplayDate', () => ({
  useDisplayDate: () => ({ formatDate: () => '14 Nov 2026' }),
}));
vi.mock('@/components/payment/PaymentQRCode', () => ({
  PaymentQRCode: () => <div data-testid="code" />,
}));
vi.mock('@/components/events/GuestTicketPurchase', () => ({ default: () => null }));
vi.mock('@/lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/x', useRouter: () => ({}) }));
const publicPayment = vi.fn();
vi.mock('@/hooks/usePublicPayment', () => ({
  usePublicPayment: (opts: unknown) => publicPayment(opts),
}));
const paymentFlow = vi.fn();
vi.mock('@/hooks/usePaymentFlow', () => ({ usePaymentFlow: () => paymentFlow() }));

const choose = () => ({
  phase: 'choose',
  intent: null,
  error: '',
  start: vi.fn(async (create: () => Promise<Response>) => void (await create())),
  acknowledge: vi.fn(),
  reset: vi.fn(),
});

const section = (entityType: 'product' | 'service', over: Record<string, unknown> = {}) => (
  <PublicEntityPaymentSection
    entityType={entityType}
    entityId="e1"
    entityTitle={entityType === 'product' ? 'Morning with Cat' : 'Custom Portrait Painting'}
    recipientName="Cato"
    priceAmount={entityType === 'product' ? 20 : 1000}
    priceCurrency="CHF"
    sellerProfileId="seller"
    sellerUserId="seller"
    sellerReceive={{ method: 'lightning_address', address: 'orangecat@coinos.io' }}
    signInRedirect="/products/e1"
    {...over}
  />
);

beforeEach(() => {
  signedIn = false;
  publicPayment.mockReturnValue(choose());
  paymentFlow.mockReturnValue({
    state: { phase: 'idle' },
    initiate: vi.fn(),
    initiateBookingPayment: vi.fn(),
    confirmPaid: vi.fn(),
    reset: vi.fn(),
    isLoading: false,
  });
  window.localStorage.clear();
});

describe('buying a product without an account', () => {
  it('names the payee and asks for the price, with no bare address to type an amount into', () => {
    render(section('product'));
    expect(screen.getByText(GUEST_PURCHASE_COPY.title)).toBeTruthy();
    expect(screen.getByText(/You pay Cato directly for Morning with Cat\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pay CHF 20.00' })).toBeTruthy();
    expect(screen.queryByText(/coinos/)).toBeNull();
    expect(screen.queryByText(/when prompted/)).toBeNull();
    expect(screen.queryByText(/also receives funds/)).toBeNull();
  });

  it('works for a seller whose wallet has no address to show', () => {
    render(section('product', { sellerReceive: { method: 'nwc', address: null } }));
    expect(screen.getByRole('button', { name: 'Pay CHF 20.00' })).toBeTruthy();
    expect(screen.queryByText(/Sign in to purchase/)).toBeNull();
  });

  it('a pass is granted to an account, so the guest panel gives way to sign-in, and says why', () => {
    render(section('product', { purchaseNeedsAccount: true }));
    expect(screen.getByText(ACCOUNT_PURCHASE_COPY.why)).toBeTruthy();
    expect(screen.getByRole('link', { name: ACCOUNT_PURCHASE_COPY.signIn })).toHaveAttribute(
      'href',
      '/auth?mode=login&from=/products/e1'
    );
    expect(screen.queryByText(GUEST_PURCHASE_COPY.title)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull();
  });

  it('sends the name and the note, and never an amount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <GuestPurchasePanel
        entityType="product"
        entityId="e1"
        entityTitle="Morning with Cat"
        recipientName="Cato"
        priceAmount={20}
        priceCurrency="CHF"
        signInHref="/auth"
      />
    );
    const pay = screen.getByRole('button', { name: 'Pay CHF 20.00' });
    expect(pay).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(GUEST_PURCHASE_COPY.noteLabel), {
      target: { value: 'ana@example.org' },
    });
    fireEvent.click(pay);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_ROUTES.PAYMENTS.PUBLIC_PURCHASE);
    expect(JSON.parse(init.body)).toEqual({
      entity_type: 'product',
      entity_id: 'e1',
      name: 'Ana',
      note: 'ana@example.org',
    });
    vi.unstubAllGlobals();
  });

  it('ends on a receipt with the order’s reference, kept on this device', () => {
    let onPaid: (s: { order_ref?: string }) => void = () => {};
    publicPayment.mockImplementation((opts: { onPaid: typeof onPaid }) => {
      onPaid = opts.onPaid;
      return {
        ...choose(),
        phase: 'paid',
        intent: { payment_intent: { amount_btc: 0.0002 } },
      };
    });
    const { rerender } = render(
      <GuestPurchasePanel
        entityType="product"
        entityId="e1"
        entityTitle="Morning with Cat"
        recipientName="Cato"
        priceAmount={20}
        priceCurrency="CHF"
        signInHref="/auth"
      />
    );
    onPaid({ order_ref: 'AB12CD34' });
    rerender(
      <GuestPurchasePanel
        entityType="product"
        entityId="e1"
        entityTitle="Morning with Cat"
        recipientName="Cato"
        priceAmount={20}
        priceCurrency="CHF"
        signInHref="/auth"
      />
    );
    expect(screen.getByText(PAYMENT_FLOW_COPY.paidTitle)).toBeTruthy();
    expect(screen.getByText('20.00')).toBeTruthy();
    expect(screen.getByText('Morning with Cat')).toBeTruthy();
    expect(
      screen.getByText(/Order AB12CD34: keep this reference\. Cato has your name\./)
    ).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('oc:guest-order:e1') ?? '{}').ref).toBe(
      'AB12CD34'
    );
  });
});

describe('a service is booked first', () => {
  it('signed out: no purchase and no address under the Book action', () => {
    render(section('service'));
    expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull();
    expect(screen.queryByText(GUEST_PURCHASE_COPY.title)).toBeNull();
    expect(screen.queryByText(/coinos/)).toBeNull();
  });

  it('signed in: no "Buy" beside the booking', () => {
    signedIn = true;
    render(section('service'));
    expect(screen.queryByRole('button', { name: /Buy/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull();
  });

  it('a product keeps its purchase when signed in', () => {
    signedIn = true;
    render(section('product'));
    expect(screen.getByRole('button', { name: /Buy for CHF 20\.00/ })).toBeTruthy();
  });
});

describe('the accepted booking asks for the payment', () => {
  it('names what is owed and starts the booking’s own payment', () => {
    const flow = paymentFlow();
    paymentFlow.mockReturnValue(flow);
    render(
      <BookingPayCard
        bookingId="b1"
        title="Custom Portrait Painting"
        amountDueBtc={0.01}
        providerHasWallet
        onDone={vi.fn()}
      />
    );
    expect(screen.getByText(BOOKING_PAY_COPY.intro('Custom Portrait Painting'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay CHF 1000.00' }));
    expect(flow.initiateBookingPayment).toHaveBeenCalledWith('b1');
  });

  it('says so, with no pay action, when the provider has no wallet', () => {
    render(
      <BookingPayCard
        bookingId="b1"
        title="Custom Portrait Painting"
        amountDueBtc={0.01}
        providerHasWallet={false}
        onDone={vi.fn()}
      />
    );
    expect(screen.getByText(BOOKING_PAY_COPY.noWallet)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull();
  });
});

describe('a request that was never made is not "a payment that failed"', () => {
  const steps = (state: Record<string, unknown>) => (
    <PaymentFlowSteps flow={{ state, confirmPaid: vi.fn(), reset: vi.fn() } as never} fixedAmount />
  );

  it('no wallet, or nothing left to pay: says it could not be started', () => {
    render(
      steps({
        phase: 'error',
        notStarted: true,
        message:
          'The provider has not connected a wallet yet, so this booking cannot be paid here.',
      })
    );
    expect(screen.getByText(PAYMENT_FLOW_COPY.notStartedTitle)).toBeTruthy();
    expect(screen.queryByText(PAYMENT_FLOW_COPY.failedTitle)).toBeNull();
    expect(screen.getByText(/has not connected a wallet/)).toBeTruthy();
  });

  it('a failure on the rail keeps its own title', () => {
    render(steps({ phase: 'error', message: 'Check your wallet history.' }));
    expect(screen.getByText(PAYMENT_FLOW_COPY.failedTitle)).toBeTruthy();
  });
});
