'use client';

/**
 * The middle and the end of an account-free payment: the QR while it is open,
 * "I've paid" where the rail cannot prove it, and the way back when it expired
 * or failed. Driven by {@link usePublicPayment}; the caller owns the start and
 * the success screens, which are what differ between support and a ticket.
 */

import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PaymentQRCode } from './PaymentQRCode';
import { PaymentStatusIndicator } from './PaymentStatusIndicator';
import type { usePublicPayment } from '@/hooks/usePublicPayment';

interface PublicPaymentProgressProps {
  payment: ReturnType<typeof usePublicPayment>;
  /** What happens after "I've paid" on a rail the recipient must confirm. */
  confirmationNote: string;
}

export function PublicPaymentProgress({ payment, confirmationNote }: PublicPaymentProgressProps) {
  const { phase, intent, error, acknowledge, reset } = payment;

  if (phase === 'creating') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-7 w-7 animate-spin text-fg-tertiary" />
        <p className="text-sm text-fg-secondary">Creating payment request…</p>
      </div>
    );
  }

  if ((phase === 'awaiting' || phase === 'recipient_confirmation') && intent) {
    return (
      <div className="space-y-4">
        <PaymentQRCode
          qrData={intent.qr_data}
          methodLabel={intent.method_label}
          amountBtc={intent.payment_intent.amount_btc}
          expiresInSeconds={intent.expires_in_seconds ?? undefined}
          size={192}
        />
        <PaymentStatusIndicator
          status={
            phase === 'recipient_confirmation' ? 'buyer_confirmed' : intent.payment_intent.status
          }
        />
        {phase === 'awaiting' && intent.payment_intent.can_acknowledge && (
          <Button variant="outline" onClick={acknowledge} className="w-full min-h-11">
            I&apos;ve paid
          </Button>
        )}
        {phase === 'recipient_confirmation' && (
          <p className="text-center text-sm text-fg-secondary">{confirmationNote}</p>
        )}
      </div>
    );
  }

  if (phase === 'expired' || phase === 'error') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-status-negative">
          {phase === 'expired' ? 'This payment request expired.' : error}
        </p>
        <Button variant="outline" onClick={reset} className="w-full min-h-11 gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return null;
}
