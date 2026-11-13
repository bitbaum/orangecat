/**
 * A project's funding goal is an amount in its currency, not a whole number.
 *
 * On orangecat.ch the create wizard's Funding step answered "Funding goal must
 * be a whole number" to 0.5 BTC, to 10000 CHF switched to BTC (0.16377602…),
 * and to CHF 2500.50. The same schema guards POST /api/projects and
 * PUT /api/projects/[id], so the API refused them too.
 */
import { describe, it, expect } from 'vitest';
import { projectSchema } from '@/lib/validation/projects';

const base = {
  title: 'A community garden',
  description: 'Raised beds for the neighbourhood.',
};

function goalErrors(goal_amount: unknown, currency = 'CHF') {
  const result = projectSchema.safeParse({ ...base, goal_amount, currency });
  return result.success ? [] : result.error.issues.map(i => i.message);
}

describe('projectSchema goal_amount', () => {
  it.each([
    ['0.5 BTC', 0.5, 'BTC'],
    ['a CHF goal switched to BTC (unrounded conversion)', 10000 / 61058.37, 'BTC'],
    ['a BTC goal at 8 decimal places', 0.16377602, 'BTC'],
    ['CHF 2500.50', 2500.5, 'CHF'],
    ['a whole CHF goal', 10000, 'CHF'],
  ])('accepts %s', (_label, amount, currency) => {
    expect(goalErrors(amount, currency)).toEqual([]);
  });

  it('still allows no goal', () => {
    expect(goalErrors(null)).toEqual([]);
    expect(goalErrors(undefined)).toEqual([]);
  });

  it.each([
    ['zero', 0, 'Funding goal must be greater than 0'],
    ['a negative amount', -1, 'Funding goal must be greater than 0'],
    ['an absurd amount', 1_000_000_001, 'Funding goal is too large'],
  ])('rejects %s', (_label, amount, message) => {
    expect(goalErrors(amount)).toEqual([message]);
  });
});
