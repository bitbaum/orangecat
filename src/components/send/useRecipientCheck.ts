'use client';

/**
 * Resolving who you're about to pay, while you type.
 *
 * Paying the wrong person is the one mistake on this screen that cannot be
 * undone — Lightning has no chargeback and no "cancel". Every consumer money
 * app therefore shows you the recipient's *name* before you can confirm, so a
 * mistyped username fails as a visible non-match rather than as a silent
 * transfer to a stranger. That check was missing here.
 *
 * The states mirror what the server will actually do with the same input
 * (see sendToRecipient), because a preview that disagrees with the payment is
 * worse than no preview:
 *  - anything containing "@" is treated as a Lightning address and paid
 *    directly, so we say plainly that we cannot vouch for who owns it;
 *  - anything else is an OrangeCat username and gets resolved to a real person
 *    with a real, working rail.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { fetchTipReceiveInfo } from '@/services/tips/tip-client';
import { USERNAME_MIN_LENGTH } from '@/config/usernames';

export type RecipientState =
  | 'idle'
  | 'checking'
  | 'ok'
  | 'external'
  | 'cannot_receive'
  /** They can be paid, but only on-chain — which Send cannot do yet. Their pay page can. */
  | 'onchain_only'
  /** The name typed is your own. */
  | 'self'
  | 'not_found';

export interface RecipientCheck {
  state: RecipientState;
  /** The resolved human name, when we have one to show. */
  name: string | null;
  /** Whether this recipient may be paid at all. */
  payable: boolean;
  /** The OrangeCat profile behind a resolved username — what a message to them needs. */
  recipientId: string | null;
}

/** Typing pause before we ask the server — long enough not to query per keystroke. */
export const RECIPIENT_CHECK_DEBOUNCE_MS = 400;

export function useRecipientCheck(recipient: string): RecipientCheck {
  // Your own name is not a person to pay or ask; say so before anything is looked up.
  const ownUsername = useAuthStore(state => state.profile?.username ?? null);
  const [check, setCheck] = useState<RecipientCheck>({
    state: 'idle',
    name: null,
    payable: false,
    recipientId: null,
  });

  useEffect(() => {
    const trimmed = recipient.trim().replace(/^@/, '');

    if (!trimmed) {
      setCheck({ state: 'idle', name: null, payable: false, recipientId: null });
      return;
    }

    // A Lightning address goes straight out to its own domain; there is no
    // OrangeCat profile behind it to resolve, and pretending otherwise would be
    // a claim we can't support.
    if (trimmed.includes('@')) {
      setCheck({ state: 'external', name: trimmed, payable: true, recipientId: null });
      return;
    }

    if (ownUsername && trimmed.toLowerCase() === ownUsername.toLowerCase()) {
      setCheck({ state: 'self', name: null, payable: false, recipientId: null });
      return;
    }

    // No username is this short, so there is nothing to look up yet — and
    // "Nobody goes by @m" after one keystroke is noise, not a finding.
    if (trimmed.length < USERNAME_MIN_LENGTH) {
      setCheck({ state: 'idle', name: null, payable: false, recipientId: null });
      return;
    }

    setCheck(prev => ({ ...prev, state: 'checking' }));

    let live = true;
    const timer = setTimeout(() => {
      fetchTipReceiveInfo(trimmed)
        .then(info => {
          if (!live) {
            return;
          }
          // Send pays over Lightning only. An on-chain-only recipient looked
          // "ok" here and was refused after the amount and the review: a
          // preview that disagrees with the payment is worse than none.
          const onchainOnly = info.canReceive && info.method === 'onchain';
          setCheck({
            state: onchainOnly ? 'onchain_only' : info.canReceive ? 'ok' : 'cannot_receive',
            name: info.recipientName || `@${trimmed}`,
            payable: info.canReceive && !onchainOnly,
            recipientId: info.recipientId ?? null,
          });
        })
        .catch(() => {
          if (live) {
            setCheck({ state: 'not_found', name: null, payable: false, recipientId: null });
          }
        });
    }, RECIPIENT_CHECK_DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [recipient, ownUsername]);

  return check;
}
