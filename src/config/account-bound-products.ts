/**
 * Products that give something to an ACCOUNT when they are paid.
 *
 * A Supporter pass raises the buyer's Cat plan; a Loki pass grants the buyer's
 * actor a plan on Loki. Both are granted to the buyer of the settled payment,
 * so a purchase made without an account would take the money and grant
 * nothing. The purchase paths read the tags through here to say so before
 * anyone pays, and the granters read the same parsers at settlement.
 */

import { parseLokiPass } from './loki-passes';

/** `{days}` if the product's tags mark it a Supporter pass, else null. */
export function parseSupporterPass(tags: unknown): { days: number } | null {
  if (!Array.isArray(tags)) {
    return null;
  }
  let isSupporter = false;
  let days: number | null = null;
  for (const raw of tags) {
    if (typeof raw !== 'string') {
      continue;
    }
    const t = raw.trim();
    if (t === 'supporter-plan') {
      isSupporter = true;
    }
    const d = /^supporter-days:(\d{1,4})$/.exec(t);
    if (d) {
      days = parseInt(d[1], 10);
    }
  }
  return isSupporter && days ? { days } : null;
}

/** Whether paying for a product with these tags grants something to the buyer's account. */
export function grantsToAnAccount(tags: unknown): boolean {
  return parseSupporterPass(tags) !== null || parseLokiPass(tags) !== null;
}

export const ACCOUNT_PURCHASE_COPY = {
  /** Why the guest path is closed, where the guest panel would be. */
  why: 'This is added to an account when it is paid, so buying it needs you signed in.',
  signIn: 'Sign in to buy',
  /** The same refusal from the server, for a client that asks anyway. */
  refusal:
    'This is added to an account when it is paid, so it cannot be bought without one. Sign in to buy it.',
} as const;
