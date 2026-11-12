// @vitest-environment jsdom
/**
 * No not-found page had an <h1> (review of production, 2026-11-12): the
 * site-wide one used <h2>, and five entity copies (project, profile, loan,
 * cause, investment) used a card title, an <h3>. They now share one view.
 */
import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';
import ProjectNotFound from '@/app/projects/[id]/not-found';
import ProfileNotFound from '@/app/profiles/[username]/not-found';
import LoanNotFound from '@/app/loans/[id]/not-found';
import CauseNotFound from '@/app/causes/[id]/not-found';
import InvestmentNotFound from '@/app/investments/[id]/not-found';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/settings/nope',
}));

describe('site-wide 404', () => {
  it('has exactly one h1', () => {
    render(<NotFound />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page Not Found');
  });
});

describe('entity not-found pages', () => {
  it.each([
    ['project', ProjectNotFound, 'Project Not Found'],
    ['profile', ProfileNotFound, 'Profile Not Found'],
    ['loan', LoanNotFound, 'Loan Not Found'],
    ['cause', CauseNotFound, 'Cause Not Found'],
    ['investment', InvestmentNotFound, 'Investment Not Found'],
  ])('the %s page names itself in its one h1 and leads home', (_kind, Page, title) => {
    render(<Page />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
    expect(screen.getByRole('link', { name: /Go Home/ })).toHaveAttribute('href', '/');
  });
});
