// @vitest-environment jsdom
/**
 * /community is readable signed out; only posting waits for sign-in.
 *
 * The footer links "Community" from every public page and the navigation calls
 * it the "Public feed". The feed reads `community_timeline_no_duplicates`, a
 * view granted to anon that holds public posts only (measured on production:
 * the anon key reads it, 1614 rows, every one `visibility = 'public'`). Yet a
 * signed-out visitor got a "Please sign in" wall — an h2, no h1, no posts — and
 * its button went to bare /auth, so signing in did not come back.
 *
 * The reader's own feeds (`timeline`, `following`) still need a reader; those
 * routes are gated by the middleware too.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Globe } from 'lucide-react';
import type { TimelineFeedResponse } from '@/types/timeline';

const auth = vi.hoisted(() => ({
  user: null as null | { id: string },
  profile: null,
  isLoading: false,
  hydrated: true,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));

const service = vi.hoisted(() => ({
  getCommunityFeed: vi.fn(),
  getEnrichedUserFeed: vi.fn(),
  getEnrichedFollowingFeed: vi.fn(),
  getProfileFeed: vi.fn(),
  searchPosts: vi.fn(),
}));

vi.mock('@/services/timeline', () => ({ timelineService: service }));

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/community',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/useTimelineQuery', () => ({
  useInvalidateTimeline: () => ({ invalidateAll: vi.fn() }),
}));

// The cards are not under test here: which feed loads, and what sits around it.
vi.mock('@/components/timeline/TimelineComponent', () => ({
  __esModule: true,
  default: ({ feed }: { feed: TimelineFeedResponse }) => (
    <ul>
      {feed.events.map(event => (
        <li key={event.id}>{event.title}</li>
      ))}
    </ul>
  ),
}));

vi.mock('@/components/timeline/TimelineComposer', () => ({
  __esModule: true,
  default: () => <div data-testid="composer" />,
}));

import SocialTimeline from '@/components/timeline/SocialTimeline';
import TimelineView from '@/components/timeline/TimelineView';

function feedOf(titles: string[]): TimelineFeedResponse {
  return {
    events: titles.map((title, i) => ({ id: `e${i}`, title })),
    pagination: { page: 1, limit: 20, total: titles.length, hasNext: false, hasPrev: false },
    filters: {},
    metadata: { totalEvents: titles.length, featuredEvents: 0, lastUpdated: '' },
  } as unknown as TimelineFeedResponse;
}

function renderCommunity() {
  return render(
    <SocialTimeline
      title="Community"
      icon={Globe}
      mode="community"
      defaultSort="trending"
      showSortingControls
      showInlineComposer
      allowProjectSelection
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  service.getCommunityFeed.mockResolvedValue(feedOf(['A public post']));
  service.getEnrichedUserFeed.mockResolvedValue(feedOf([]));
  service.getEnrichedFollowingFeed.mockResolvedValue(feedOf([]));
  service.getProfileFeed.mockResolvedValue(feedOf(['A post on a profile']));
});

describe('the community feed, signed out', () => {
  it('loads the public feed under the page h1 instead of a sign-in wall', async () => {
    renderCommunity();

    expect(await screen.findByText('A public post')).toBeTruthy();
    expect(service.getCommunityFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Community' })).toBeTruthy();
    expect(screen.queryByText('Please sign in')).toBeNull();
  });

  it('hides only the composer, and offers a sign-in that comes back to /community', async () => {
    // The setup file's location stub; stand on /community.
    window.location.pathname = '/community';
    window.location.search = '';

    renderCommunity();
    await screen.findByText('A public post');

    expect(screen.queryByTestId('composer')).toBeNull();
    expect(screen.getByText('Sign in to post')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(router.push).toHaveBeenCalledWith(`/auth?from=${encodeURIComponent('/community')}`);
  });

  it('signed in, shows the composer and no sign-in prompt', async () => {
    auth.user = { id: 'u1' };
    renderCommunity();

    await screen.findByText('A public post');
    expect(screen.getByTestId('composer')).toBeTruthy();
    expect(screen.queryByText('Sign in to post')).toBeNull();
  });
});

describe("the reader's own feeds, signed out", () => {
  it.each(['timeline', 'following'] as const)(
    '%s still asks for sign-in and reads nothing',
    async mode => {
      render(<SocialTimeline title="Feed" icon={Globe} mode={mode} />);

      expect(await screen.findByText('Please sign in')).toBeTruthy();
      await waitFor(() => {
        expect(service.getEnrichedUserFeed).not.toHaveBeenCalled();
        expect(service.getEnrichedFollowingFeed).not.toHaveBeenCalled();
        expect(service.getCommunityFeed).not.toHaveBeenCalled();
      });
    }
  );
});

describe('TimelineView keeps the same truth and the same prompt', () => {
  it('reads the community feed signed out', async () => {
    render(<TimelineView feedType="community" />);

    expect(await screen.findByText('A public post')).toBeTruthy();
    expect(screen.queryByText('Please sign in')).toBeNull();
  });

  it("a profile's timeline offers the same sign-in, back to the tab it was on", async () => {
    window.location.pathname = '/profiles/cato';
    window.location.search = '?tab=timeline';

    render(<TimelineView feedType="profile" ownerId="p1" showComposer />);
    await screen.findByText('A post on a profile');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(router.push).toHaveBeenCalledWith(
      `/auth?from=${encodeURIComponent('/profiles/cato?tab=timeline')}`
    );
  });
});
