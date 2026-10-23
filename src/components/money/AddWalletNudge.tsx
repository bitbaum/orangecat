'use client';

/**
 * The way forward when the person you are about to pay has nowhere to receive.
 *
 * A dead end says "can't" and stops. This says why and offers the one thing
 * that actually helps: a person asking a person, in a message that is already
 * written and that nothing sends until the payer does. It is the same line on
 * Send and on the public pay page, so the two cannot drift apart.
 */

import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { SEND_COPY } from '@/config/send';

interface AddWalletNudgeProps {
  /** Who they are, as shown ("Marco"). */
  name: string;
  /** Their profile id — what the message opens to. */
  recipientId: string;
}

export function AddWalletNudge({ name, recipientId }: AddWalletNudgeProps) {
  return (
    <Link
      href={ROUTES.MESSAGES_TO(recipientId, 'add-wallet')}
      className="mt-1 flex min-h-11 items-center text-fg-primary underline underline-offset-2"
    >
      {SEND_COPY.recipientNudge(name)}
    </Link>
  );
}
