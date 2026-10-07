/**
 * Raise plans: a model's answer never reaches the page unchecked, a cost the
 * person stated beats any estimate, and every rail becomes a payload its
 * entity's own schema accepts.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizePlan,
  planToEntityRequest,
  planTotal,
  statedCost,
  type RaisePlan,
} from '@/domain/raise/plan';
import { projectSchema } from '@/lib/validation/projects';
import { investmentSchema, loanSchema } from '@/lib/validation/finance';
import { RAISE_LIMITS } from '@/config/raise';

const fmt = (n: number) => `CHF ${n}`;

describe('statedCost', () => {
  it.each([
    ['A new oven, about CHF 4,000', 4000],
    ['4000 francs for a laptop', 4000],
    ['costs 2.5k', 2500],
    ['€1’200 for rent', 1200],
    ['budget of 750', 750],
  ])('%s → %d', (text, n) => {
    expect(statedCost(text)).toBe(n);
  });

  it('ignores numbers that are not prices', () => {
    expect(statedCost('3 months of studio rent')).toBeNull();
    expect(statedCost('my dog is 9 years old')).toBeNull();
  });
});

describe('normalizePlan', () => {
  it('clips, clamps and drops what a model should not have said', () => {
    const plan = normalizePlan('A bakery oven', 'CHF', {
      title: 'x'.repeat(300),
      lines: [
        { label: 'Oven', amount: 3999.6 },
        { label: 'Refund', amount: -50 },
        { label: '', amount: 10 },
        ...Array.from({ length: 20 }, (_, i) => ({ label: `L${i}`, amount: 1 })),
      ],
      rail: 'lend',
      rate_percent: 900,
      term_months: 0,
    });
    expect(plan.title.length).toBeLessThanOrEqual(RAISE_LIMITS.titleMax);
    expect(plan.lines[0]).toEqual({ label: 'Oven', amount: 4000 });
    expect(plan.lines).toHaveLength(RAISE_LIMITS.maxLines);
    expect(plan.lines.some(l => l.amount <= 0 || !l.label)).toBe(false);
    expect(plan.ratePercent).toBe(RAISE_LIMITS.rateMax);
    expect(plan.termMonths).toBe(1);
    expect(plan.estimated).toBe(true);
  });

  it('keeps the person’s stated cost over an estimate that disagrees', () => {
    const plan = normalizePlan('Vet bills, about CHF 2,000', 'CHF', {
      lines: [
        { label: 'Surgery', amount: 3000 },
        { label: 'Aftercare', amount: 500 },
      ],
    });
    expect(planTotal(plan)).toBe(2000);
    expect(plan.estimated).toBe(false);
  });

  it('keeps a breakdown that adds up to what they said', () => {
    const plan = normalizePlan('Vet bills, about CHF 2,000', 'CHF', {
      lines: [
        { label: 'Surgery', amount: 1600 },
        { label: 'Aftercare', amount: 400 },
      ],
    });
    expect(plan.lines).toHaveLength(2);
  });

  it('still makes a plan with no model at all', () => {
    const plan = normalizePlan('Three months of studio rent while I finish my album', 'CHF', null);
    expect(plan.title).toBe('Three months of studio rent while I finish my album');
    expect(plan.story).toContain('studio rent');
    expect(plan.rail).toBe('fund');
    expect(plan.lines).toEqual([]);
  });

  it('rounds BTC to sats, not to whole coins', () => {
    const plan = normalizePlan('A node', 'BTC', {
      lines: [{ label: 'Node', amount: 0.0123456789 }],
    });
    expect(plan.lines[0].amount).toBe(0.01234568);
  });
});

const base: RaisePlan = {
  need: 'A second oven',
  title: 'A second oven for the bakery',
  story: 'We sell out by noon. A second oven lets us bake on weekdays too.',
  currency: 'CHF',
  lines: [
    { label: 'Deck oven', amount: 3500 },
    { label: 'Installation', amount: 500 },
  ],
  rail: 'fund',
  railWhy: '',
  estimated: true,
  ratePercent: 5,
  termMonths: 24,
};

describe('planToEntityRequest', () => {
  it('fund → a project its schema accepts, with the breakdown in the story', () => {
    const { entityType, payload } = planToEntityRequest(base, fmt);
    expect(entityType).toBe('project');
    expect(projectSchema.safeParse(payload).success).toBe(true);
    expect(payload.goal_amount).toBe(4000);
    expect(payload.description).toContain('Deck oven: CHF 3500');
    expect(payload.description).toContain('Total: CHF 4000');
  });

  it('lend → a public loan with the terms written out', () => {
    const { entityType, payload } = planToEntityRequest({ ...base, rail: 'lend' }, fmt);
    expect(entityType).toBe('loan');
    expect(loanSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ original_amount: 4000, interest_rate: 5, is_public: true });
    expect(payload.preferred_terms).toContain('24 months');
  });

  it('invest → a public revenue-share offering with a sensible minimum', () => {
    const { entityType, payload } = planToEntityRequest({ ...base, rail: 'invest' }, fmt);
    expect(entityType).toBe('investment');
    expect(investmentSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ target_amount: 4000, minimum_investment: 40, is_public: true });
  });
});
