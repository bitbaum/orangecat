/**
 * Drafts the app can leave waiting in a conversation's composer — typed FOR
 * the person, never sent for them.
 *
 * A link names one of these by key (`/messages?to=<id>&draft=add-wallet`),
 * never carries the words: free text in a URL would let any page pre-write a
 * message into someone else's composer. An unknown key is ignored.
 */

import { ROUTES } from '@/config/routes';

export const MESSAGE_DRAFTS = {
  /**
   * Someone tried to pay a person who has no wallet to receive Bitcoin. A
   * human asking is easier to say yes to than a notification, and costs
   * both sides a minute.
   */
  'add-wallet': (origin: string) =>
    `Hi! I went to send you Bitcoin on OrangeCat, but you haven't added a wallet to receive it yet. It takes about a minute, and this page shows how: ${origin}${ROUTES.WALLETS.LIST}`,
} as const;

export type MessageDraftKey = keyof typeof MESSAGE_DRAFTS;

export function isMessageDraftKey(key: string | null | undefined): key is MessageDraftKey {
  return typeof key === 'string' && Object.hasOwn(MESSAGE_DRAFTS, key);
}
