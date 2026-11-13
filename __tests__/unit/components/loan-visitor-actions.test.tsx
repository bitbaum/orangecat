// @vitest-environment jsdom
/**
 * Measured on orangecat.ch (2026-11-12, 390px and 1366px):
 *
 *   - Signed in, a stranger's loan offered "Contact Lister — Sign in to contact
 *     the loan lister or make an offer", and the phone's "Contact lister" bar,
 *     both linking to /auth?from=<this loan>. Sign-in sends a signed-in visitor
 *     straight back to `from`, so the only action on the page went nowhere.
 *     Contacting the lister now opens a message to them, as "Ask … about this"
 *     does on every listing; signed out, sign-in leads into that message.
 *   - Cancelled loans answered 200 to strangers and were in the sitemap: the
 *     loan rule was `is_public` INSTEAD of the active-status rule, while search
 *     and Discover require both. The rule is now both, everywhere it is read.
 */
import { render, screen } from '@testing-library/react';
import { loanDetailConfig } from '@/components/public/detail-configs/loan';
import { MobileStickyCTA } from '@/components/public/PublicEntityStickyCTA';
import { PUBLIC_VISIBILITY } from '@/config/public-visibility';
import { applyVisibility } from '@/lib/entities/visibility';
import { inquiryHref } from '@/features/messaging/lib/draft';
import { getTableName } from '@/config/entity-registry';

const fakeAdmin = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeAdmin.client }));
vi.mock('@/services/articles/get-article', () => ({ listPublicArticleRefs: async () => [] }));
vi.mock('@/lib/blog', () => ({ getPublishedPosts: () => [] }));

const loan = {
  id: 'loan-1',
  title: 'Refinance the van',
  created_at: '2026-10-01T00:00:00Z',
  currency: 'CHF',
  original_amount: 2500,
  remaining_balance: 2500,
};
const contactHref = inquiryHref('lister-user', { title: loan.title, path: '/loans/loan-1' });

function sidebar(isOwner: boolean, isSignedIn: boolean, href: string | null) {
  render(<div>{loanDetailConfig.renderSidebarExtra?.(loan, isOwner, isSignedIn, href)}</div>);
}

describe('contacting a loan lister', () => {
  it('opens a message to the lister about this loan for a signed-in visitor', () => {
    sidebar(false, true, contactHref);
    const link = screen.getByRole('link', { name: /contact lister/i });
    const url = new URL(link.getAttribute('href') ?? '', 'https://example.test');
    expect(url.pathname).toBe('/messages');
    expect(url.searchParams.get('to')).toBe('lister-user');
    expect(url.searchParams.get('about')).toBe(loan.title);
    expect(url.searchParams.get('ref')).toBe('/loans/loan-1');
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    // Offers are made from the dashboard, not here: the card must not promise one.
    expect(screen.queryByText(/make an offer/i)).not.toBeInTheDocument();
  });

  it('signed out, goes through sign-in and on into that same message', () => {
    sidebar(false, false, contactHref);
    const href = screen.getByRole('link', { name: /contact lister/i }).getAttribute('href') ?? '';
    const url = new URL(href, 'https://example.test');
    expect(url.pathname).toBe('/auth');
    expect(url.searchParams.get('mode')).toBe('login');
    expect(url.searchParams.get('from')).toBe(contactHref);
    expect(screen.getByText(/sign in to message the lister/i)).toBeInTheDocument();
  });

  it('offers the owner nothing to contact on their own loan', () => {
    sidebar(true, true, contactHref);
    expect(screen.queryByRole('link', { name: /contact lister/i })).not.toBeInTheDocument();
    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
  });

  it('shows no contact link when the lister cannot be messaged', () => {
    sidebar(false, true, null);
    expect(screen.queryByRole('link', { name: /contact lister/i })).not.toBeInTheDocument();
  });

  it("the phone's sticky bar opens the same message", () => {
    render(
      <MobileStickyCTA
        config={loanDetailConfig}
        entity={loan}
        payable={false}
        isSignedIn
        contactHref={contactHref}
      />
    );
    expect(screen.getByRole('link', { name: 'Contact lister' })).toHaveAttribute(
      'href',
      contactHref
    );
  });

  it("the phone's sticky bar sends a signed-out visitor through sign-in to it", () => {
    render(
      <MobileStickyCTA
        config={loanDetailConfig}
        entity={loan}
        payable={false}
        isSignedIn={false}
        contactHref={contactHref}
      />
    );
    const href = screen.getByRole('link', { name: 'Contact lister' }).getAttribute('href') ?? '';
    expect(new URL(href, 'https://example.test').searchParams.get('from')).toBe(contactHref);
  });

  it('shows no sticky bar when there is nobody to message', () => {
    const { container } = render(
      <MobileStickyCTA
        config={loanDetailConfig}
        entity={loan}
        payable={false}
        isSignedIn
        contactHref={null}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

type Row = { id: string; updated_at: string | null } & Record<string, unknown>;

/** Just enough of PostgREST for the sitemap: eq / in / not-like, then await. */
function fakeTable(rows: Row[]) {
  let kept = rows;
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => (
      (kept = kept.filter(r => r[column] === value)),
      builder
    ),
    in: (column: string, values: readonly unknown[]) => (
      (kept = kept.filter(r => values.includes(r[column]))),
      builder
    ),
    not: () => builder,
    then: (resolve: (v: { data: Row[] }) => unknown) => resolve({ data: kept }),
  };
  return builder;
}

describe('a cancelled loan is not public', () => {
  it('needs both the owner switch and an active status', () => {
    const calls: Array<[string, unknown]> = [];
    const builder = {
      eq: (column: string, value: unknown) => (calls.push([column, value]), builder),
      in: (column: string, values: unknown) => (calls.push([column, values]), builder),
    };
    applyVisibility(builder, loanDetailConfig.visibilityFilter);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['is_public', true],
        ['status', 'active'],
      ])
    );
    expect(loanDetailConfig.visibilityFilter).toBe(PUBLIC_VISIBILITY.loan);
  });

  it('leaves every other type on the active-status default', () => {
    const calls: Array<[string, unknown]> = [];
    const builder = {
      eq: (column: string, value: unknown) => (calls.push([column, value]), builder),
      in: (column: string, values: unknown) => (calls.push([column, values]), builder),
    };
    applyVisibility(builder, undefined);
    expect(calls).toEqual([['status', 'active']]);
  });

  it('is not listed in the sitemap, and an active public loan still is', async () => {
    const loans: Row[] = [
      { id: 'active-public', updated_at: null, is_public: true, status: 'active' },
      { id: 'cancelled-public', updated_at: null, is_public: true, status: 'cancelled' },
      { id: 'paid-off-public', updated_at: null, is_public: true, status: 'paid_off' },
      { id: 'active-private', updated_at: null, is_public: false, status: 'active' },
    ];
    fakeAdmin.client = {
      from: (table: string) => fakeTable(table === getTableName('loan') ? loans : []),
    };
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = (await sitemap()).map(entry => entry.url);
    const loanUrls = urls.filter(url => url.includes('/loans/'));
    expect(loanUrls).toHaveLength(1);
    expect(loanUrls[0]).toMatch(/\/loans\/active-public$/);
  });
});
