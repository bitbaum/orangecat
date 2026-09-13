/**
 * Contract test for the Loki Bitcoin entitlement rail.
 *
 * Proves the seed's product tags (what OrangeCat WRITES) are exactly what the
 * settlement notifier PARSES, and that the derived webhook payload satisfies
 * Loki's receiver contract. Loki's verifier
 * (src/app/api/orangecat/entitlement/route.ts in the Loki repo) enforces:
 *   plan ∈ its plan enum · externalId 1..200 chars · periodDays a positive int ≤ 3660.
 * If the tag format, the plan set, or a price ever drifts, this fails before a
 * dormant rail ships.
 */
import {
  LOKI_PASSES,
  LOKI_PLANS,
  parseLokiPass,
  passTags,
} from '@/config/loki-passes';

describe('Loki passes — tag/parse contract', () => {
  it('every catalogued pass round-trips through parseLokiPass', () => {
    for (const pass of LOKI_PASSES) {
      expect(parseLokiPass(pass.tags)).toEqual({
        plan: pass.plan,
        periodDays: pass.periodDays,
      });
    }
  });

  it('covers exactly the paid plans, once each', () => {
    const plans = LOKI_PASSES.map(p => p.plan).sort();
    expect(plans).toEqual([...LOKI_PLANS].sort());
    expect(new Set(plans).size).toBe(LOKI_PASSES.length);
  });

  it('passTags is the exact inverse of parseLokiPass', () => {
    for (const plan of LOKI_PLANS) {
      expect(parseLokiPass(passTags(plan, 30))).toEqual({ plan, periodDays: 30 });
    }
  });

  it('rejects non-pass / malformed tags', () => {
    expect(parseLokiPass(null)).toBeNull();
    expect(parseLokiPass(['random', 'tags'])).toBeNull();
    expect(parseLokiPass(['loki-plan:pro'])).toBeNull(); // missing days
    expect(parseLokiPass(['loki-days:30'])).toBeNull(); // missing plan
    expect(parseLokiPass(['loki-plan:bogus', 'loki-days:30'])).toBeNull();
  });

  it('derived entitlement payload satisfies Loki’s receiver constraints', () => {
    for (const pass of LOKI_PASSES) {
      const parsed = parseLokiPass(pass.tags);
      expect(parsed).not.toBeNull();
      // plan is a bounded token Loki's zod enum accepts
      expect(LOKI_PLANS).toContain(parsed!.plan);
      // periodDays: positive int ≤ 3660
      expect(Number.isInteger(parsed!.periodDays)).toBe(true);
      expect(parsed!.periodDays).toBeGreaterThan(0);
      expect(parsed!.periodDays).toBeLessThanOrEqual(3660);
    }
  });

  it('prices match Loki /pricing (all to-be-announced), guarding accidental drift', () => {
    const byPlan = Object.fromEntries(LOKI_PASSES.map(p => [p.plan, p.price]));
    // null = price not announced yet. When pricing launches, set the numbers in
    // BOTH configs (here and Loki's plans.ts) and update this guard.
    expect(byPlan).toEqual({ personal: null, pro: null, team: null });
    for (const p of LOKI_PASSES) {
      expect(p.currency).toBe('CHF');
    }
  });
});
