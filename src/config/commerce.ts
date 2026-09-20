/**
 * May OrangeCat take money FOR ITSELF?
 *
 * This is a COMMERCIAL switch, not a technical one, and it is the whole point
 * of the file: until the company exists, OrangeCat must not accept a payment
 * from anybody, however well the plumbing works.
 *
 * Before this, the only thing standing between OrangeCat and someone's money
 * was `platformReceiveEnabled()` — which asks whether a receiving wallet URI
 * happens to be configured. That is infrastructure. Configuring a wallet to
 * test a top-up would have opened the till as a side effect, which is not a
 * decision anyone would have made on purpose.
 *
 * ── What this does NOT gate ────────────────────────────────────────────────
 *
 * Payments BETWEEN USERS. Someone funding a project, buying a listing, or
 * settling a loan is the product, it is 0% fees, the money never touches
 * OrangeCat, and none of it is affected by anything in this file. Only the
 * two places where money is owed to OrangeCat are:
 *
 *   1. Cat Credits top-up  (prepaid balance for frontier models)
 *   2. The Supporter plan  (a subscription)
 *
 * ── Fails closed ───────────────────────────────────────────────────────────
 *
 * The flag is off unless someone explicitly sets it to the string "true". A
 * missing env var, a typo, a new deploy target with a half-copied env file —
 * every one of those means CLOSED. Taking money you are not yet allowed to
 * take is the expensive direction of this error, so the cheap direction is
 * the default.
 */

import { FEATURES } from './features';

/**
 * True only when OrangeCat is legally and operationally able to charge.
 *
 * Flip by setting NEXT_PUBLIC_PAID_PLANS_OPEN=true in the deploy env, once
 * the company is registered and able to receive and invoice. Nothing else in
 * the codebase should ask this question its own way.
 */
export const PAID_PLANS_OPEN = FEATURES.paidPlansOpen;

/**
 * Copy for the moment of truth.
 *
 * Deliberately says WHY, and says what still works. "Payments are disabled"
 * reads like a fault; this is a choice, and a user who understands it is a
 * user who comes back when it opens.
 */
export const COMMERCE_CLOSED = {
  /** Short label for a button or badge. */
  badge: 'Not open yet',
  /** One line, for beside a price. */
  short: 'OrangeCat cannot take payments yet.',
  /** The full explanation, for the checkout surface itself. */
  full: 'OrangeCat is not yet a registered company, so it cannot accept payments — not for credits, not for plans. Prices are real and the plumbing is built and tested; the checkout is the one thing switched off. Everything free keeps working, and paying other people on OrangeCat was never affected: that money goes directly to them, at 0% fees.',
  /** What to do in the meantime. */
  meanwhile:
    'In the meantime: the free pool needs no setup, and bringing your own API key costs OrangeCat nothing and gives you frontier models today.',
} as const;
