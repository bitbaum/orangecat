// @vitest-environment jsdom
/**
 * A kind with nothing in it says what it is and how to start one.
 *
 * On orangecat.ch, /circles (→ /discover?type=circles) showed only
 * "0 circles, newest first" over an empty grid, /research the same, and a kind
 * with one listing read "1 loans". /dashboard/circles said "No circles yet"
 * with no button: the dashboard hides its header Create button while the list
 * is empty, and the circles empty state (like wishlists and documents) brought
 * no action of its own.
 */
import { render, screen, within } from '@testing-library/react';
import EntityDashboardPage from '@/components/entity/EntityDashboardPage';
import { DiscoverScreen } from '@/components/discover/DiscoverScreen';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { circleEntityConfig } from '@/config/entities/circles';
import type { DiscoverParams } from '@/services/discover/params';
import type { PublicHit } from '@/services/search/public-search';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const dashboard = vi.hoisted(() => ({ total: 0, items: [] as Array<{ id: string }> }));
vi.mock('@/hooks/useEntityDashboard', () => ({
  useEntityDashboard: () => ({
    user: { id: 'u1' },
    authLoading: false,
    hydrated: true,
    userCurrency: 'CHF',
    selectedIds: new Set(),
    toggleSelect: vi.fn(),
    toggleSelectAll: vi.fn(),
    clearSelection: vi.fn(),
    showSelection: false,
    setShowSelection: vi.fn(),
    deletingIds: new Set(),
    changingStatusIds: new Set(),
    activeTabId: undefined,
    setActiveTabId: vi.fn(),
    activeTab: undefined,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusValue: 'all',
    setStatusValue: vi.fn(),
    loading: false,
    error: null,
    page: 1,
    total: dashboard.total,
    setPage: vi.fn(),
    refresh: vi.fn(),
    filteredItems: dashboard.items,
    isDeleting: false,
    bulkDeleteConfirm: false,
    setBulkDeleteConfirm: vi.fn(),
    handleBulkDelete: vi.fn(),
    executeBulkDelete: vi.fn(),
    handleStatusChange: vi.fn(),
    handleDeleteItem: vi.fn(),
  }),
}));

const params = (type: DiscoverParams['type']): DiscoverParams => ({ q: '', type, page: 1 });

const loan: PublicHit = {
  type: 'loan',
  id: 'l1',
  title: 'Roof repair',
  snippet: '',
  imageUrl: null,
  href: '/loans/l1',
  amount: null,
  currency: null,
  startsAt: null,
  place: null,
  createdAt: '2026-11-01',
  handle: null,
  rank: 1,
};

describe('Discover, one kind with nothing public yet', () => {
  it('says what a circle is and links to starting one, instead of "0 circles"', () => {
    render(
      <DiscoverScreen
        params={params('circle')}
        view={{
          mode: 'browse',
          counts: { project: 4 },
          type: 'circle',
          hits: [],
          total: 0,
          hasMore: false,
          fallback: [],
        }}
      />
    );
    const section = screen.getByRole('region', { name: 'Circles' });
    expect(section).not.toHaveTextContent('0 circles');
    expect(section).toHaveTextContent('No circles listed yet.');
    expect(section).toHaveTextContent(ENTITY_REGISTRY.circle.plain.verb);
    expect(section).toHaveTextContent(ENTITY_REGISTRY.circle.plain.what);
    const start = within(section).getByRole('link', { name: 'List the first one' });
    expect(start).toHaveAttribute('href', ENTITY_REGISTRY.circle.createPath);
  });

  it('does the same for every kind, research included', () => {
    render(
      <DiscoverScreen
        params={params('research')}
        view={{
          mode: 'browse',
          counts: {},
          type: 'research',
          hits: [],
          total: 0,
          hasMore: false,
          fallback: [],
        }}
      />
    );
    expect(screen.getByText('No research listed yet.')).toBeInTheDocument();
    expect(screen.getByText(ENTITY_REGISTRY.research.plain.what)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'List the first one' })).toHaveAttribute(
      'href',
      ENTITY_REGISTRY.research.createPath
    );
  });

  it('counts one of a kind in the singular', () => {
    render(
      <DiscoverScreen
        params={params('loan')}
        view={{
          mode: 'browse',
          counts: { loan: 1 },
          type: 'loan',
          hits: [loan],
          total: 1,
          hasMore: false,
          fallback: [],
        }}
      />
    );
    expect(screen.getByText('1 loan, newest first')).toBeInTheDocument();
    expect(screen.queryByText(/1 loans/)).not.toBeInTheDocument();
  });
});

describe('a dashboard list with nothing in it', () => {
  beforeEach(() => {
    dashboard.total = 0;
    dashboard.items = [];
  });

  it('says what a circle is and offers the button that starts one', () => {
    render(
      <EntityDashboardPage
        config={circleEntityConfig}
        title="My Circles"
        createButtonLabel="Start a Circle"
      />
    );
    expect(screen.getByText('No circles yet')).toBeInTheDocument();
    expect(
      screen.getByText(/A circle is a light community around a shared interest/)
    ).toBeInTheDocument();
    const starts = screen.getAllByRole('link', { name: 'Start a Circle' });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toHaveAttribute('href', ENTITY_REGISTRY.circle.createPath);
  });

  it('keeps a single Create button in the header once something is listed', () => {
    dashboard.total = 1;
    dashboard.items = [];
    render(<EntityDashboardPage config={circleEntityConfig} createButtonLabel="Start a Circle" />);
    expect(screen.getAllByRole('link', { name: 'Start a Circle' })).toHaveLength(1);
  });
});
