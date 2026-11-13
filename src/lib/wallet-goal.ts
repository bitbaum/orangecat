/**
 * Savings-goal progress for a wallet — the one place the two units are reconciled.
 *
 * A wallet's balance is BTC (`balance_btc`). Its goal is NOT: `goal_amount` is
 * denominated in `goal_currency`, and the wallet form defaults that to a fiat
 * code. Both surfaces that drew the progress bar divided one by the other
 * directly:
 *
 *   progressPercent = (wallet.balance_btc / wallet.goal_amount) * 100
 *
 * which is BTC ÷ CHF. Measured against production on 2026-08-26: 18 of 33
 * wallets carry a goal, every one of them in fiat (CHF 11, USD 6, EUR 1), and
 * not one in BTC. The bug is invisible today only because every one of those
 * balances is still 0.00 — it starts lying the moment the feature starts
 * working. A wallet holding 0.03 BTC toward a CHF 2 500 goal would have read
 * "0.0% funded" while sitting at roughly the whole target.
 *
 * Two components had their own copy of that expression (WalletCard, and
 * ProfileWalletSection on the PUBLIC profile), which is why this is a module and
 * not an inline fix: one definition of the comparison, and a gate
 * (scripts/check-currency-units.mjs) so a third copy cannot be written.
 *
 * The honesty rule this encodes: when the rate needed to compare them is not
 * available, there is no percentage. `useCurrencyConversion` returns 0 for an
 * unknown rate precisely so callers do not guess, and 0 read as a percentage
 * would claim "nothing saved" about a wallet that may be fully funded. In that
 * case `percent` is null and callers render the target without a bar.
 */

/** Currency code the platform stores Bitcoin amounts in. */
const BTC = 'BTC';

export interface WalletGoalInput {
  /** On-chain balance, always BTC. */
  balanceBtc: number | null | undefined;
  /** Target, denominated in `goalCurrency` — NOT in BTC unless that is the code. */
  goalAmount: number | null | undefined;
  goalCurrency: string | null | undefined;
}

export interface WalletGoalProgress {
  /** The target, echoed back as a number for formatting. */
  goalAmount: number;
  /** The currency BOTH numbers below are expressed in. */
  currency: string;
  /** The wallet's balance converted into `currency`, or null when unconvertible. */
  balanceInGoalCurrency: number | null;
  /** 0–100+, or null when the two amounts cannot honestly be compared. */
  percent: number | null;
}

/**
 * @param convertFromBtc `useCurrencyConversion().convertFromBTC` — injected so
 *   this stays a pure function and can be tested without the rate cache.
 * @returns null when the wallet has no goal to show.
 */
export function computeWalletGoalProgress(
  input: WalletGoalInput,
  convertFromBtc: (btc: number, currency: string) => number
): WalletGoalProgress | null {
  const goalAmount = Number(input.goalAmount ?? 0);
  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    return null;
  }

  const currency = (input.goalCurrency || BTC).toUpperCase();
  // `Number(null)` is 0, not NaN — so null must be rejected before coercion, or
  // "we did not fetch this" becomes "this wallet holds nothing".
  const balanceBtc =
    input.balanceBtc === null || input.balanceBtc === undefined
      ? Number.NaN
      : Number(input.balanceBtc);

  // An absent balance is UNKNOWN, not zero. `balance_btc` is not among the
  // public wallet fields, so a visitor's payload simply does not carry it, and
  // coercing that to 0 would report "0% funded" about a wallet we never looked
  // at — the same mistake as printing a balance we never fetched.
  const balanceInGoalCurrency = !Number.isFinite(balanceBtc)
    ? null
    : // A BTC-denominated goal needs no conversion, and an empty wallet is zero
      // in every currency, so it needs no rate either. Both are exact.
      currency === BTC || balanceBtc === 0
      ? balanceBtc
      : orNull(convertFromBtc(balanceBtc, currency));

  return {
    goalAmount,
    currency,
    balanceInGoalCurrency,
    percent: balanceInGoalCurrency === null ? null : (balanceInGoalCurrency / goalAmount) * 100,
  };
}

/**
 * A converted amount of 0 from a non-zero balance means "no rate for this
 * currency" — the rate cache signals a miss with 0 rather than guessing. Treat
 * it as unknown, never as "you have nothing".
 */
function orNull(converted: number): number | null {
  return Number.isFinite(converted) && converted > 0 ? converted : null;
}

/**
 * A wallet's balance as far as anyone has measured it: `balance_btc` only when
 * `balance_updated_at` says a chain lookup happened, else null (unknown).
 *
 * The column defaults to 0, so a wallet nobody has read carries 0 — and the
 * owner's own profile showed "Current Balance CHF 0.00" and the wallet list
 * "0.0% funded" beside "Not checked yet" (production, 2026-11-12). A balance we
 * never read is not a balance of zero. A visitor's payload carries neither
 * field, which is also null here.
 */
export function measuredBalanceBtc(wallet: {
  balance_btc?: number | null;
  balance_updated_at?: string | null;
}): number | null {
  return wallet.balance_updated_at && typeof wallet.balance_btc === 'number'
    ? wallet.balance_btc
    : null;
}
