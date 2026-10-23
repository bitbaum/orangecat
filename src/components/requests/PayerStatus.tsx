'use client';

/**
 * Who you are about to ask, resolved while you type.
 *
 * A request is ADDRESSED: it notifies a specific OrangeCat account. So the
 * question here is different from the one on /send. Sending cares whether the
 * destination can receive; requesting cares only whether the person exists,
 * because they will pay from their own wallet — asking someone who has no
 * receiving rail set up is perfectly normal, and refusing that would be
 * nonsense.
 *
 * A Lightning address is the one input that looks valid and is not: it is a
 * destination, not an account, so there is nobody to notify.
 */

import { CheckCircle2, Loader2 } from 'lucide-react';
import { StatusNote } from '@/components/money/StatusNote';
import type { RecipientCheck } from '@/components/send/useRecipientCheck';
import { REQUEST_COPY } from '@/config/payment-requests';

/** Whether this input names someone a request can actually be sent to. */
export function isRequestablePayer(check: RecipientCheck): boolean {
  // 'cannot_receive' still means we found the account — see above.
  return check.state === 'ok' || check.state === 'cannot_receive' || check.state === 'onchain_only';
}

export function PayerStatus({ check, handle }: { check: RecipientCheck; handle: string }) {
  const cleanHandle = handle.trim().replace(/^@/, '');

  switch (check.state) {
    case 'idle':
      return null;

    case 'checking':
      return (
        <p className="flex items-center gap-2 text-sm text-fg-tertiary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {REQUEST_COPY.payerChecking}
        </p>
      );

    case 'self':
      return <StatusNote tone="warning">{REQUEST_COPY.payerSelf}</StatusNote>;

    case 'ok':
    case 'cannot_receive':
    case 'onchain_only':
      return (
        <StatusNote tone="positive">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-status-positive" aria-hidden="true" />
          {REQUEST_COPY.payerReady(check.name ?? `@${cleanHandle}`)}
        </StatusNote>
      );

    case 'external':
      return <StatusNote tone="warning">{REQUEST_COPY.payerExternal}</StatusNote>;

    case 'not_found':
      return <StatusNote tone="warning">{REQUEST_COPY.payerNotFound(cleanHandle)}</StatusNote>;
  }
}
