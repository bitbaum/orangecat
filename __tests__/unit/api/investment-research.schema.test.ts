/**
 * Investment and Research schema validation tests
 *
 * These schemas had a bug where funding_goal_btc used min(1000) — treating
 * the BTC field as satoshis (1000 sats). Fixed to positive(). These tests
 * lock in the correct BTC-denominated validation rules.
 */

import { investmentSchema } from '@/lib/validation';
import { researchEntitySchema } from '@/config/entity-configs/research-config';

// ── Investment ─────────────────────────────────────────────────────────────

describe('investmentSchema', () => {
  const base = {
    title: 'Smoke Investment',
    description: 'Revenue-share investment for community solar farm expansion.',
    investment_type: 'revenue_share' as const,
    target_amount: 0.5,
    minimum_investment: 0.001,
    lightning_address: '',
  };

  it('accepts valid payload with BTC amounts', () => {
    expect(investmentSchema.safeParse(base).success).toBe(true);
  });

  it('accepts small BTC target (e.g. 0.001 BTC)', () => {
    expect(investmentSchema.safeParse({ ...base, target_amount: 0.001 }).success).toBe(true);
  });

  it('rejects zero target_amount', () => {
    const r = investmentSchema.safeParse({ ...base, target_amount: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects negative target_amount', () => {
    const r = investmentSchema.safeParse({ ...base, target_amount: -0.5 });
    expect(r.success).toBe(false);
  });

  it('rejects minimum_investment > maximum_investment', () => {
    const r = investmentSchema.safeParse({
      ...base,
      minimum_investment: 0.1,
      maximum_investment: 0.05,
    });
    expect(r.success).toBe(false);
  });

  it('accepts minimum_investment <= maximum_investment', () => {
    expect(
      investmentSchema.safeParse({
        ...base,
        minimum_investment: 0.05,
        maximum_investment: 0.1,
      }).success
    ).toBe(true);
  });

  it('rejects missing required title', () => {
    const { title: _, ...noTitle } = base;
    expect(investmentSchema.safeParse(noTitle).success).toBe(false);
  });

  it('rejects description shorter than 10 chars', () => {
    expect(investmentSchema.safeParse({ ...base, description: 'Too short' }).success).toBe(false);
  });
});

// ── Research ───────────────────────────────────────────────────────────────

describe('researchEntitySchema — funding_goal_btc is BTC, not satoshis', () => {
  const base = {
    title: 'Bitcoin Adoption Study',
    description: 'Comprehensive study on Bitcoin adoption in emerging markets.',
    field: 'economics' as const,
    methodology: 'empirical' as const,
    expected_outcome: 'Quantitative model of adoption drivers.',
    timeline: 'medium_term' as const,
    funding_goal_btc: 0.5,
    funding_model: 'donation' as const,
    lead_researcher: 'Dr. Satoshi',
    progress_frequency: 'monthly' as const,
    transparency_level: 'full' as const,
  };

  it('accepts a BTC funding goal (0.5 BTC)', () => {
    expect(researchEntitySchema.safeParse(base).success).toBe(true);
  });

  it('accepts a small BTC goal (0.001 BTC — Cat default)', () => {
    expect(researchEntitySchema.safeParse({ ...base, funding_goal_btc: 0.001 }).success).toBe(true);
  });

  it('accepts a tiny BTC goal (0.00001 BTC — domain default)', () => {
    expect(researchEntitySchema.safeParse({ ...base, funding_goal_btc: 0.00001 }).success).toBe(
      true
    );
  });

  it('rejects zero funding_goal_btc', () => {
    const r = researchEntitySchema.safeParse({ ...base, funding_goal_btc: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects negative funding_goal_btc', () => {
    const r = researchEntitySchema.safeParse({ ...base, funding_goal_btc: -0.5 });
    expect(r.success).toBe(false);
  });

  it('rejects unknown field enum value', () => {
    const r = researchEntitySchema.safeParse({ ...base, field: 'astrology' });
    expect(r.success).toBe(false);
  });

  it('rejects unknown methodology enum value', () => {
    const r = researchEntitySchema.safeParse({ ...base, methodology: 'vibes' });
    expect(r.success).toBe(false);
  });
});
