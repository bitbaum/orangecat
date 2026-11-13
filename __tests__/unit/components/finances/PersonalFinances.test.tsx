// @vitest-environment jsdom
/**
 * The finances overview on first run: every empty card names its next step as
 * a link, not as prose, and the totals are set as money figures.
 */

import { render, screen } from '@testing-library/react';
import { PersonalFinances } from '@/components/finances/PersonalFinances';
import { FINANCES_PAGE } from '@/config/finances';
import { ROUTES } from '@/config/routes';
import type { PersonalFinances as Finances } from '@/domain/finances/service';

function finances(over: Partial<Finances> = {}): Finances {
  return {
    currency: 'CHF',
    income: { payments: 0, total: 0, totalBtc: 0, valuedAtToday: 0, windowDays: 365 },
    debts: [],
    civicSplit: null,
    tax: null,
    ...over,
  } as Finances;
}

describe('PersonalFinances, first run', () => {
  it('gives "Came in" one action that leads to getting paid', () => {
    render(<PersonalFinances finances={finances()} />);
    const link = screen.getByRole('link', { name: FINANCES_PAGE.income.emptyCta });
    expect(link.getAttribute('href')).toBe(ROUTES.RECEIVE);
  });

  it('offers "Declare it" in the tax card too, where the estimate needs a place', () => {
    render(<PersonalFinances finances={finances()} />);
    const links = screen.getAllByRole('link', { name: FINANCES_PAGE.civic.cta });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(ROUTES.DASHBOARD.CIVIC_SPLIT);
    }
  });

  it('sets income as a money figure, the number apart from its unit', () => {
    render(
      <PersonalFinances
        finances={finances({
          income: { payments: 2, total: 120, totalBtc: 0.0012, valuedAtToday: 0, windowDays: 365 },
        } as Partial<Finances>)}
      />
    );
    expect(screen.getByText('120').className).toContain('tabular-nums');
  });
});
