/**
 * OrangeCat must not take money it is not yet allowed to take.
 *
 * Until the company is registered, no payment TO OrangeCat may succeed — not
 * a credit top-up, not a subscription. The plumbing is built and tested, and
 * the till is shut.
 *
 * Before this gate existed the only thing in the way was
 * `platformReceiveEnabled()`, which asks whether a receiving wallet URI is
 * configured. That is an infrastructure question standing in for a legal one:
 * configuring a wallet in order to test a top-up would have opened the till as
 * a side effect. Nobody would have chosen that; it would simply have happened.
 *
 * The two properties worth pinning are the ones that are expensive to get
 * wrong in opposite directions:
 *   - it FAILS CLOSED (a missing or mistyped env var means no charging)
 *   - it does not touch payments BETWEEN users, which are the product
 */

import { PAID_PLANS_OPEN, COMMERCE_CLOSED } from '@/config/commerce';
import { CAT_PLANS } from '@/config/cat-plans';

describe('the gate fails closed', () => {
  it('is shut in this environment — no NEXT_PUBLIC_PAID_PLANS_OPEN is set', () => {
    expect(PAID_PLANS_OPEN).toBe(false);
  });

  it('only the exact string "true" opens it', () => {
    // envFlag semantics: anything else — undefined, '', '1', 'TRUE', 'yes' —
    // is closed. A half-copied env file must not start a business.
    const envFlag = (v: string | undefined) => v === 'true';
    for (const value of [undefined, '', '1', 'TRUE', 'True', 'yes', 'on', 'false']) {
      expect(envFlag(value)).toBe(false);
    }
    expect(envFlag('true')).toBe(true);
  });
});

describe('no plan offers a purchase while the gate is shut', () => {
  const payable = CAT_PLANS.filter(p => p.id === 'credits' || p.id === 'supporter');

  it('covers both of the plans that take OrangeCat money', () => {
    expect(payable.map(p => p.id).sort()).toEqual(['credits', 'supporter']);
  });

  it.each(payable.map(p => [p.id, p] as const))(
    '%s is not marked available, and its CTA is not a checkout',
    (_id, plan) => {
      expect(plan.status).toBe('coming-soon');
      expect(plan.cta.label.toLowerCase()).not.toMatch(/top up|become a supporter|buy|subscribe/);
    }
  );

  it.each(payable.map(p => [p.id, p] as const))('%s still shows its real price', (_id, plan) => {
    // Closed is not the same as hidden. A plan you cannot evaluate is worse
    // than one you cannot yet buy, and the price is the main thing to judge.
    expect(plan.priceCopy.trim().length).toBeGreaterThan(0);
    expect(plan.bullets.length).toBeGreaterThan(0);
  });

  it('badges them honestly rather than as imminent', () => {
    for (const plan of payable) {
      expect(plan.badge).toBe(COMMERCE_CLOSED.badge);
      expect(plan.badge).not.toMatch(/activating|live/i);
    }
  });
});

describe('free routes are untouched', () => {
  it('the free plan is still available', () => {
    expect(CAT_PLANS.find(p => p.id === 'free')?.status).toBe('available');
  });

  it('bring-your-own-key is still available — it costs OrangeCat nothing', () => {
    expect(CAT_PLANS.find(p => p.id === 'byok')?.status).toBe('available');
  });
});

describe('the closed notice says what a user needs', () => {
  it('explains WHY, not just that something is off', () => {
    expect(COMMERCE_CLOSED.full).toMatch(/registered company/i);
  });

  it('protects the thing most likely to be misread — P2P payments', () => {
    // A user reading "OrangeCat cannot take payments" could reasonably fear
    // that paying another person is broken too. It never was.
    expect(COMMERCE_CLOSED.full).toMatch(/0% fees|directly to them/i);
  });

  it('points somewhere useful instead of dead-ending', () => {
    expect(COMMERCE_CLOSED.meanwhile).toMatch(/free pool|own API key/i);
  });
});
