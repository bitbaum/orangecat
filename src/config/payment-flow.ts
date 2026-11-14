/**
 * The one payment flow's words — SSOT.
 *
 * Paying a person (/pay), supporting a page, investing, buying a product, a
 * ticket or a booked service are the same act on screen: an amount, a code,
 * and one of three endings (paid, expired, failed). They used to be four
 * implementations with four vocabularies ("Pay CHF 10.00", "Create Bitcoin
 * request", "Buy Now (CHF 20.00)", "Tip with a Bitcoin wallet"; "Waiting for
 * the payment…" beside "Waiting for payment..."), so a payer could not tell
 * that they were the same thing.
 *
 * /pay is the model, so its words (src/config/pay.ts) are the ones reused here;
 * only what /pay never needed is added. Every surface reads from this file.
 */

import { PAY_COPY } from './pay';

/** What the payer is doing. The verb is the only word that differs. */
export type PaymentAct = 'pay' | 'support' | 'invest';

export const PAYMENT_VERBS: Record<PaymentAct, string> = {
  pay: 'Pay',
  support: 'Support',
  invest: 'Invest',
};

export const PAYMENT_FLOW_COPY = {
  /** The one action: the verb and the figure ("Pay CHF 20.00", "Invest CHF 60.00"). */
  action: (act: PaymentAct, amount: string) => `${PAYMENT_VERBS[act]} ${amount}`,
  /** The same button before an amount is entered. */
  enterAmount: PAY_COPY.enterAmount,
  preparing: PAY_COPY.generating,
  /** Under every code, in secondary ink. */
  waiting: PAY_COPY.scan,
  /** The way back from a code whose amount the payer chose. */
  changeAmount: PAY_COPY.again,
  /** The way back from a code whose amount is a price. */
  back: 'Back',
  /** On a rail that cannot prove payment, the payer says so. */
  iPaid: 'I’ve paid',
  claimedTitle: 'Waiting for them to confirm',
  claimedBody: 'They confirm once it shows in their wallet. You do not need to pay again.',
  paidTitle: PAY_COPY.paidTitle,
  expiredTitle: PAY_COPY.expiredTitle,
  expiredBody: PAY_COPY.expiredBody,
  failedTitle: 'This payment did not go through',
  /** The request was never made (no wallet, nothing left to pay): no money was in play. */
  notStartedTitle: 'This could not be started',
  again: 'Try again',
  done: 'Done',
  /** The honesty line, on every amount step and every code. */
  custody: PAY_COPY.disclaimer,
  /** A purchase's receipt leads to the record of it. */
  seeOrder: 'See your order',
  seeBooking: 'See your booking',
} as const;

/** "You pay Cato directly for Remise Rosa." — the payee, then what it is for. */
export function payeeLine(payee: string | null | undefined, forWhat?: string | null): string {
  const name = payee?.trim() || 'the owner';
  const what = forWhat?.trim();
  return what && what !== name
    ? `You pay ${name} directly for ${what}.`
    : `You pay ${name} directly.`;
}

/** The receipt's "For" row: what was paid for, unless that is the payee itself. */
export function receiptNote(forWhat: string | null | undefined, payee?: string | null) {
  const what = forWhat?.trim();
  return what && what !== payee?.trim() ? what : null;
}

/**
 * Kinds that are booked first and paid once the provider accepts. Their page
 * leads with booking and offers no purchase: paying first left the provider
 * with money and no appointment, and booking first left a "pay" beside it that
 * never met the booking. The payment is asked for on the accepted booking.
 */
const BOOKED_BEFORE_PAID: readonly string[] = ['service'];

export function isBookedBeforePaid(entityType: string): boolean {
  return BOOKED_BEFORE_PAID.includes(entityType);
}

/** Said under the Book action of a priced listing that is paid on acceptance. */
export const PAY_AFTER_ACCEPT_LINE = 'You pay once they accept. Paid straight to their wallet.';

/** The refusal when something booked-first is "bought" in the web app. */
export const BOOK_FIRST_MESSAGE =
  'This is booked first and paid once the provider accepts. Book it on its page; the payment is asked for on the accepted booking.';
