// @vitest-environment jsdom
/**
 * Two small things a signed-out visitor met on public listing pages:
 *  - the breadcrumb's first crumb was "Home" → the dashboard, which answers a
 *    visitor with the sign-in form; public pages now start at Discover;
 *  - a project nobody can pay yet said "No contributions yet — be the first."
 */
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (n: number) => `${n} BTC` }),
}));
vi.mock('@/lib/projectGoal', () => ({ computeAmountRaised: async (btc: number) => btc }));

import { Breadcrumb, PUBLIC_BREADCRUMB_ROOT } from '@/components/ui/Breadcrumb';
import ProjectSummaryRail from '@/components/project/ProjectSummaryRail';
import { ROUTES } from '@/config/routes';

describe('the breadcrumb’s first crumb', () => {
  it('is the dashboard inside the app', () => {
    render(<Breadcrumb items={[{ label: 'Wallets' }]} />);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe(
      ROUTES.DASHBOARD.HOME
    );
  });

  it('is Discover on a public page', () => {
    render(<Breadcrumb root={PUBLIC_BREADCRUMB_ROOT} items={[{ label: 'Products' }]} />);
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Discover' }).getAttribute('href')).toBe(
      ROUTES.DISCOVER
    );
  });
});

describe('a project’s funding line', () => {
  const project = { id: 'p', goal_amount: null, currency: 'CHF', user_id: 'u' };

  it('invites the first contribution only when one can be made', () => {
    const { unmount } = render(<ProjectSummaryRail project={project} />);
    expect(screen.getByText('No contributions yet — be the first.')).toBeTruthy();
    unmount();

    render(<ProjectSummaryRail project={project} payable={false} />);
    expect(screen.getByText('Not open for funding yet.')).toBeTruthy();
    expect(screen.queryByText(/be the first/)).toBeNull();
  });
});
