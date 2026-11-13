// @vitest-environment jsdom
/**
 * The way into OrangeCat from its public pages: one action, one name, one
 * target, and it is the warm one only where it brings a newcomer in.
 *
 * Found in the 2026-11-12 audit: the hero and the home band sent a first-time
 * visitor to /auth with no mode, which greets with "Welcome back, sign in";
 * the pages closed with six different names for that action; and on /pricing
 * the warm action sat on Bring your own key, not on the free plan.
 */
import { render, screen } from '@testing-library/react';
import { PublicLinkList } from '@/components/layout/PublicLinkList';
import { PublicStartBand } from '@/components/layout/PublicStartBand';
import { CAT_PLANS } from '@/config/cat-plans';
import { CTA_LABELS } from '@/config/landing-page';
import { authNavigationItems } from '@/config/navigation';
import { ROUTES } from '@/config/routes';

describe('the start band', () => {
  it('names the action once and opens the register form', () => {
    render(<PublicStartBand>Start here.</PublicStartBand>);
    const link = screen.getByRole('link', { name: CTA_LABELS.primaryAction });
    expect(link).toHaveAttribute('href', ROUTES.AUTH_REGISTER);
  });

  it('is the same action as the header’s', () => {
    const [, getStarted] = authNavigationItems;
    expect(getStarted).toEqual({ name: CTA_LABELS.primaryAction, href: ROUTES.AUTH_REGISTER });
  });
});

describe('pricing: one warm action', () => {
  it('is on the free plan, and on no other', () => {
    const warm = CAT_PLANS.filter(plan => plan.cta.variant === 'accent');
    expect(warm.map(plan => plan.id)).toEqual(['free']);
  });
});

describe('PublicLinkList', () => {
  it('makes every row one link, mail and other sites included', () => {
    render(
      <PublicLinkList
        rows={[
          { href: '/ecosystem', title: 'The stack', line: 'Three products' },
          { href: 'https://example.com/repo', title: 'Source', line: 'On GitHub' },
          { href: 'mailto:someone@example.com', title: 'Write to us', line: 'someone@example.com' },
        ]}
      />
    );
    const links = screen.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/ecosystem',
      'https://example.com/repo',
      'mailto:someone@example.com',
    ]);
    expect(links[1]).toHaveAttribute('target', '_blank');
    expect(links[2]).not.toHaveAttribute('target');
  });
});
