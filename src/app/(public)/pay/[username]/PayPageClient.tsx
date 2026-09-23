'use client';

/**
 * The payer's view of a pay link.
 *
 * Prefills from the URL are treated as suggestions: the amount lands in the
 * input and the note is shown as context, but the payer can change either.
 * An amount we cannot parse is reported in place — a link that silently drops
 * its amount and renders a blank form is the failure mode that makes people
 * distrust payment links.
 */

import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { PayFlow } from '@/components/payment/PayFlow';
import { parsePayPrefill, PAY_COPY } from '@/config/pay';

interface PayPageClientProps {
  username: string;
  recipientName: string;
  /** Resolved on the server so the amount field is there on the first paint. */
  canReceive: boolean;
}

export function PayPageClient({ username, recipientName, canReceive }: PayPageClientProps) {
  const searchParams = useSearchParams();
  const prefill = useMemo(() => parsePayPrefill(searchParams), [searchParams]);

  return (
    <PayFlow
      username={username}
      recipientName={recipientName}
      initialCanReceive={canReceive}
      initialAmountBtc={prefill.amountBtc}
      words={PAY_COPY}
      noteSlot={
        prefill.note ? (
          <p className="rounded-md border border-subtle bg-surface-raised/40 px-3 py-2 text-center text-sm text-fg-secondary">
            {PAY_COPY.requestedFor(prefill.note)}
          </p>
        ) : null
      }
      beforeActionSlot={
        prefill.amountError ? (
          <p className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning-subtle px-3 py-2 text-sm text-fg-secondary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
            <span>{prefill.amountError}</span>
          </p>
        ) : null
      }
    />
  );
}
