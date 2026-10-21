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
import { fetchTipReceiveInfo } from '@/services/tips/tip-client';
import { USERNAME_MIN_LENGTH } from '@/config/usernames';

export type RecipientState =
  'idle' | 'checking' | 'ok' | 'external' | 'cannot_receive' | 'not_found';

export interface RecipientCheck {
  state: RecipientState;
  /** The resolved human name, when we have one to show. */
  name: string | null;
  /** Whether this recipient may be paid at all. */
  payable: boolean;
}

/** Typing pause before we ask the server — long enough not to query per keystroke. */
export const RECIPIENT_CHECK_DEBOUNCE_MS = 400;

export function useRecipientCheck(recipient: string): RecipientCheck {
  const [check, setCheck] = useState<RecipientCheck>({
    state: 'idle',
    name: null,
    payable: false,
  });

  useEffect(() => {
    const trimmed = recipient.trim().replace(/^@/, '');

    if (!trimmed) {
      setCheck({ state: 'idle', name: null, payable: false });
      return;
    }

    // A Lightning address goes straight out to its own domain; there is no
    // OrangeCat profile behind it to resolve, and pretending otherwise would be
    // a claim we can't support.
    if (trimmed.includes('@')) {
      setCheck({ state: 'external', name: trimmed, payable: true });
      return;
    }

    // No username is this short, so there is nothing to look up yet — and
    // "Nobody goes by @m" after one keystroke is noise, not a finding.
    if (trimmed.length < USERNAME_MIN_LENGTH) {
      setCheck({ state: 'idle', name: null, payable: false });
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
          setCheck({
            state: info.canReceive ? 'ok' : 'cannot_receive',
            name: info.recipientName || `@${trimmed}`,
            payable: info.canReceive,
          });
        })
        .catch(() => {
          if (live) {
            setCheck({ state: 'not_found', name: null, payable: false });
          }
        });
    }, RECIPIENT_CHECK_DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [recipient]);

  return check;
}
