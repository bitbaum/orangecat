'use client';

/**
 * What we know about the person you typed, shown before the amount is even set.
 *
 * Reads back a name for a resolved account, and says plainly when we cannot
 * vouch for a destination. The distinction matters: a username resolves to a
 * person with a working rail, while a Lightning address is a string we hand
 * straight to another server — the payment will go somewhere either way, and
 * only one of those is a somewhere we can name.
 */

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { StatusNote } from '@/components/money/StatusNote';
import type { RecipientCheck } from '@/components/send/useRecipientCheck';
import { ROUTES } from '@/config/routes';
import { SEND_COPY } from '@/config/send';

export function RecipientStatus({ check, handle }: { check: RecipientCheck; handle: string }) {
  const cleanHandle = handle.trim().replace(/^@/, '');

  switch (check.state) {
    case 'idle':
      return null;

    case 'checking':
      return (
        <p className="flex items-center gap-2 text-sm text-fg-tertiary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {SEND_COPY.recipientChecking}
        </p>
      );

    case 'ok':
      return (
        <StatusNote tone="positive">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-status-positive" aria-hidden="true" />
          {SEND_COPY.recipientReady(check.name ?? cleanHandle)}
        </StatusNote>
      );

    case 'external':
      return (
        <StatusNote tone="warning">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          {SEND_COPY.recipientExternal}
        </StatusNote>
      );

    case 'cannot_receive': {
      const who = check.name ?? `@${cleanHandle}`;
      return (
        <StatusNote tone="warning">
          {SEND_COPY.recipientCannotReceive(who)}
          {check.recipientId && (
            // No dead end: a person asking a person is the easiest yes. The
            // message opens with the words already written; nothing is sent.
            <Link
              href={ROUTES.MESSAGES_TO(check.recipientId, 'add-wallet')}
              className="mt-1 flex min-h-11 items-center text-fg-primary underline underline-offset-2"
            >
              {SEND_COPY.recipientNudge(who)}
            </Link>
          )}
        </StatusNote>
      );
    }

    case 'not_found':
      return <StatusNote tone="warning">{SEND_COPY.recipientNotFound(cleanHandle)}</StatusNote>;
  }
}
