/**
 * Where the next payment to a person lands — their own ordered rule, applied.
 *
 * A rule is a list of lines, each one of the person's wallets:
 *   - a SHARE: "25% of everything that comes in" — compared in BTC, so it needs
 *     no exchange rate at all;
 *   - a FILL: an amount to reach in a named currency, once (a debt) or every
 *     calendar month (rent, insurance) — compared at the price each payment
 *     was worth when it arrived (payment_intents.rates_at_paid).
 *
 * The whole next payment goes to the FIRST line still behind its target.
 * OrangeCat holds nothing and splits nothing: one payment, one destination,
 * and over many payments the totals converge on the rule. When every line is
 * satisfied the caller falls back to the person's usual wallet.
 *
 * Pure: rows in, a decision out. No clock, no network — `now` and today's
 * rates are arguments, so every case below is testable as a table.
 */

export type RouteKind = 'share' | 'fill';
export type RoutePeriod = 'once' | 'monthly';

export interface RouteLine {
  walletId: string;
  kind: RouteKind;
  /** share: basis points of every inflow (2500 = 25%). */
  shareBps: number | null;
  /** fill: the amount to reach, in targetCurrency. */
  targetAmount: number | null;
  targetCurrency: string | null;
  period: RoutePeriod;
  /** Payments before this never count towards the line. ISO timestamp. */
  startsAt: string;
}

export interface RoutedPayment {
  /** The wallet it landed in. */
  walletId: string;
  amountBtc: number;
  /** BTC price per currency when it was paid; null = unknown. */
  ratesAtPaid: Record<string, number> | null;
  /** ISO timestamp. */
  paidAt: string;
}

export interface LineProgress {
  walletId: string;
  /** What has landed in the line's wallet within its window, in `unit`. */
  received: number;
  /** What the line should have received by now, in `unit`. */
  target: number;
  /** 'BTC' for shares, the fill's currency otherwise. */
  unit: string;
  /** Still owed something — the next payment may go here. */
  behind: boolean;
  /**
   * Payments in the window whose value is unknown in `unit` (no price at
   * arrival, none today). Counted as 0, so a line never reads as filled on
   * money nobody can value.
   */
  unvalued: number;
}

/** The first moment of the calendar month containing `now`, UTC. */
function startOfMonthUtc(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function windowStart(line: RouteLine, now: Date): number {
  const starts = Date.parse(line.startsAt);
  return line.period === 'monthly' ? Math.max(starts, startOfMonthUtc(now)) : starts;
}

function valueIn(
  payment: RoutedPayment,
  currency: string,
  todayRates: Readonly<Record<string, number>>
): number | null {
  // A fill named in BTC needs no price: the amount is the value.
  if (currency === 'BTC') {
    return payment.amountBtc;
  }
  const atArrival = payment.ratesAtPaid?.[currency];
  if (typeof atArrival === 'number' && Number.isFinite(atArrival) && atArrival > 0) {
    return payment.amountBtc * atArrival;
  }
  const today = todayRates[currency];
  if (typeof today === 'number' && Number.isFinite(today) && today > 0) {
    return payment.amountBtc * today;
  }
  return null;
}

export function lineProgress(
  line: RouteLine,
  payments: readonly RoutedPayment[],
  now: Date,
  todayRates: Readonly<Record<string, number>> = {}
): LineProgress {
  const from = windowStart(line, now);
  const inWindow = payments.filter(p => Date.parse(p.paidAt) >= from);
  const mine = inWindow.filter(p => p.walletId === line.walletId);

  if (line.kind === 'share') {
    // "25% of everything that comes in": everything since the line began,
    // whichever wallet it landed in, against what landed in this one.
    const everything = inWindow.reduce((n, p) => n + p.amountBtc, 0);
    const received = mine.reduce((n, p) => n + p.amountBtc, 0);
    const target = ((line.shareBps ?? 0) / 10_000) * everything;
    // Before anything has come in, both are 0 — and a share comes FIRST, so the
    // very first payment goes to it. After that, a share holding exactly its
    // part is satisfied, or a fully met rule would never reach the usual wallet.
    const behind = everything === 0 || received < target;
    return { walletId: line.walletId, received, target, unit: 'BTC', behind, unvalued: 0 };
  }

  const currency = (line.targetCurrency ?? '').toUpperCase();
  let received = 0;
  let unvalued = 0;
  for (const p of mine) {
    const v = valueIn(p, currency, todayRates);
    if (v === null) {
      unvalued += 1;
    } else {
      received += v;
    }
  }
  const target = line.targetAmount ?? 0;
  return {
    walletId: line.walletId,
    received,
    target,
    unit: currency,
    behind: received < target,
    unvalued,
  };
}

/**
 * The wallet the next payment should land in, or null when every line is
 * satisfied (or there is no rule) — the caller then uses the usual wallet.
 */
export function chooseRoutedWallet(
  lines: readonly RouteLine[],
  payments: readonly RoutedPayment[],
  now: Date,
  todayRates: Readonly<Record<string, number>> = {}
): string | null {
  for (const line of lines) {
    if (lineProgress(line, payments, now, todayRates).behind) {
      return line.walletId;
    }
  }
  return null;
}
