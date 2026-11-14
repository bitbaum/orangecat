'use client';

/**
 * Paying a booking the provider accepted — the one payment flow, on the
 * booking. A service is booked first; this card appears for the customer once
 * the provider has accepted, asks for exactly what the booking recorded, and
 * ends on the same receipt as every other payment. It replaces a panel that
 * showed the provider's bare address and never told the booking it was paid.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PaymentFlowSteps } from '@/components/payment/PaymentFlowSteps';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { PAYMENT_FLOW_COPY } from '@/config/payment-flow';
import { ROUTES } from '@/config/routes';
import { displayBTC } from '@/services/currency';

export const BOOKING_PAY_COPY = {
  title: 'Pay for this booking',
  intro: (title: string) =>
    `The provider accepted. You pay them directly for ${title}; OrangeCat never holds the money.`,
  noWallet:
    'The provider has not connected a Bitcoin wallet yet, so this booking cannot be paid here. Ask them how they would like to be paid.',
  paidNote: 'The provider sees this booking as paid.',
} as const;

interface BookingPayCardProps {
  bookingId: string;
  /** What was booked, for the words and the receipt's "For". */
  title: string;
  /** What is still owed, in BTC — the server charges its own reading of it. */
  amountDueBtc: number;
  /** Whether a payment can reach the provider at all (resolved on the server). */
  providerHasWallet: boolean;
  /** Called when the customer leaves the receipt, so the page can show "paid". */
  onDone: () => void;
}

export function BookingPayCard({
  bookingId,
  title,
  amountDueBtc,
  providerHasWallet,
  onDone,
}: BookingPayCardProps) {
  const { formatAmountBtc, displayCurrency } = useDisplayCurrency();
  const flow = usePaymentFlow();
  const { state, initiateBookingPayment, isLoading } = flow;

  if (!providerHasWallet) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-fg-secondary">
          {BOOKING_PAY_COPY.noWallet}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{BOOKING_PAY_COPY.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.phase === 'idle' && (
          <>
            <p className="text-sm text-fg-secondary">{BOOKING_PAY_COPY.intro(title)}</p>
            <Button
              className="w-full"
              onClick={() => void initiateBookingPayment(bookingId)}
              disabled={isLoading}
            >
              {PAYMENT_FLOW_COPY.action('pay', formatAmountBtc(amountDueBtc))}
            </Button>
            {displayCurrency !== 'BTC' && (
              <p className="mb-0 text-center text-xs tabular-nums text-fg-tertiary">
                {displayBTC(amountDueBtc)}
              </p>
            )}
          </>
        )}
        <PaymentFlowSteps
          flow={flow}
          fixedAmount
          forWhat={title}
          receiptFootnote={BOOKING_PAY_COPY.paidNote}
        >
          {state.phase === 'success' && (
            <Button variant="outline" href={ROUTES.DASHBOARD.ORDERS}>
              {PAYMENT_FLOW_COPY.seeOrder}
            </Button>
          )}
          <Button onClick={onDone}>{PAYMENT_FLOW_COPY.done}</Button>
        </PaymentFlowSteps>
      </CardContent>
    </Card>
  );
}
