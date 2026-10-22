// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { DashboardTimeline } from '@/components/dashboard/DashboardTimeline';
import type { TimelineFeedResponse } from '@/types/timeline';
vi.mock('@/components/timeline/PostCard', () => ({
  PostCard: ({ event }: { event: { title: string } }) => <article>{event.title}</article>,
}));
vi.mock('@/lib/supabase/browser', () => ({ default: {} }));

it('previews three events without claiming the whole timeline has ended', () => {
  const feed = {
    events: [1, 2, 3, 4].map(id => ({ id: String(id), title: `Update ${id}` })),
    pagination: { hasNext: false },
  } as unknown as TimelineFeedResponse;
  render(
    <DashboardTimeline timelineFeed={feed} isLoading={false} error={null} onRefresh={() => {}} />
  );
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.queryByText('Update 4')).not.toBeInTheDocument();
  expect(screen.queryByText(/reached the end/i)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View timeline' })).toHaveAttribute('href', '/timeline');
});
