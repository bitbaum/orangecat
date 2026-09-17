// @vitest-environment jsdom
/**
 * A project is the platform's milestone-accountability entity: people fund it on
 * the promise of work getting done by a date. The create form has collected
 * `target_completion` since the entity existed and no surface rendered it, so
 * backers could see the goal and never the deadline attached to it.
 *
 * The value already reached this component — the page fetch is `select('*')` and
 * spreads the whole row. What kept it off screen was the prop interface not
 * declaring it: a narrow prop type hides a wide payload, and the compiler cannot
 * warn about a field it was never told exists.
 *
 * Gated by scripts/check-dead-fields.mjs; this is the instance.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (n: number) => `${n} BTC`,
    formatAmount: (n: number) => `${n}`,
  }),
}));

vi.mock('@/lib/projectGoal', () => ({
  computeAmountRaised: async (btc: number) => btc,
}));

import ProjectSummaryRail from '@/components/project/ProjectSummaryRail';

const base = {
  id: 'proj-1',
  goal_amount: 1000,
  currency: 'CHF',
  user_id: 'user-1',
};

describe('project target completion', () => {
  it('shows the date backers are being asked to fund toward', () => {
    render(<ProjectSummaryRail project={{ ...base, target_completion: '2027-03-15' }} />);
    expect(screen.getByText('Target completion')).toBeInTheDocument();
    expect(screen.getByText('15 March 2027')).toBeInTheDocument();
  });

  it("shows the creator's own words when the value is not a date", () => {
    // `target_completion` is optionalText, not a timestamp — the form accepts
    // "end of Q3" and printing "Invalid Date" over that would be worse than
    // printing nothing.
    render(<ProjectSummaryRail project={{ ...base, target_completion: 'end of Q3' }} />);
    expect(screen.getByText('end of Q3')).toBeInTheDocument();
  });

  it('renders no row when the creator gave no date', () => {
    render(<ProjectSummaryRail project={base} />);
    expect(screen.queryByText('Target completion')).not.toBeInTheDocument();
  });
});
