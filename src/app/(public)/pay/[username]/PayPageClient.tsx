'use client';

/**
 * The payer's view of a pay link.
 *
 * Prefills from the URL are treated as suggestions: the amount lands in the
 * input and the note is shown as context, but the payer can change either.
 * An amount we cannot parse is reported in place — a link that silently drops
 * its amount and renders a blank form is the failure mode that makes people
 * distrust payment links.
 *
 * Bitcoin is the first way when the recipient has it (the invoice is minted
 * from their own wallet). The other ways they listed follow, carrying the same
 * amount. A recipient with no Bitcoin wallet but a Twint number is still
 * payable — the page is only a dead end when there is no way at all.
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { AmountField } from '@/components/money/AmountField';
import { OtherWaysToPay } from '@/components/payment/OtherWaysToPay';
import { PayFlow } from '@/components/payment/PayFlow';
import { parsePayPrefill, PAY_COPY, PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import type { PublicPaymentMethod } from '@/domain/payments/paymentMethodsService';

interface PayPageClientProps {
  username: string;
  recipientName: string;
  /** Where an Ask about an on-request rail lands. */
  recipientId: string;
  /** Resolved on the server so the amount field is there on the first paint. */
  canReceive: boolean;
  /** The recipient's other ways to be paid, resolved on the server. */
  methods: PublicPaymentMethod[];
}

export function PayPageClient({
  username,
  recipientName,
  recipientId,
  canReceive,
  methods,
}: PayPageClientProps) {
  const searchParams = useSearchParams();
  const prefill = useMemo(() => parsePayPrefill(searchParams), [searchParams]);
  const [amountBtc, setAmountBtc] = useState(prefill.amountBtc ?? 0);

  const noteSlot = prefill.note ? (
    <p className="rounded-md border border-subtle bg-surface-raised/40 px-3 py-2 text-center text-sm text-fg-secondary">
      {PAY_COPY.requestedFor(prefill.note)}
    </p>
  ) : null;

  const amountErrorSlot = prefill.amountError ? (
    <p className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning-subtle px-3 py-2 text-sm text-fg-secondary">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
      <span>{prefill.amountError}</span>
    </p>
  ) : null;

  const otherWays = (
    <OtherWaysToPay
      recipientName={recipientName}
      recipientId={recipientId}
      methods={methods}
      amountBtc={amountBtc}
      afterBitcoin={canReceive}
    />
  );

  if (!canReceive && methods.length > 0) {
    return (
      <div className="space-y-6">
        {noteSlot}
        <AmountField
          value={amountBtc}
          onChange={setAmountBtc}
          minBtc={PAY_MIN_BTC}
          maxBtc={PAY_MAX_BTC}
        />
        {amountErrorSlot}
        {otherWays}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PayFlow
        username={username}
        recipientName={recipientName}
        initialCanReceive={canReceive}
        initialAmountBtc={prefill.amountBtc ?? 0}
        onAmountChange={setAmountBtc}
        words={PAY_COPY}
        noteSlot={noteSlot}
        beforeActionSlot={amountErrorSlot}
      />
      {otherWays}
    </div>
  );
}
