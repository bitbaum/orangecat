/** Orders — the page's words and what each status is called (SSOT). */

import { STATUS } from './database-constants';

type OrderStatus = (typeof STATUS.ORDERS)[keyof typeof STATUS.ORDERS];

export const ORDERS_PAGE = {
  title: 'Orders',
  lede: 'What you sold and what you bought, once it is paid: who it is with, their note, and the reference you can both quote. The money went straight between your wallets.',
  empty:
    'No orders yet. When something you sell or buy here is paid, it shows up with who it is with and their note.',
  sold: 'Sold',
  bought: 'Bought',
  reviewsLink: 'Review the other side in Deals',
  /** On Deals: sales to buyers without an account, and every buyer's note, are here. */
  fromDeals: 'Every order, with the buyer’s note',
} as const;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Not paid',
  paid: 'Paid',
  shipped: 'Sent',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_COPY = {
  ref: (ref: string) => `Order ${ref}`,
  soldTo: 'Sold to',
  boughtFrom: 'Bought from',
  noAccount: 'no account',
  someone: 'someone',
  noteFromBuyer: 'Their note',
  yourNote: 'Your note',
  /** A buyer without an account left no note: the seller has only a name. */
  guestNoNote: 'They left no note. They paid without an account, so there is nobody to message.',
  booking: 'See the booking',
} as const;

/** A buyer's note is how the seller reaches them or where the thing goes — not a thread. */
export const GUEST_ORDER_NOTE_MAX = 500;
