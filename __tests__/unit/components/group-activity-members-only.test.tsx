// @vitest-environment jsdom
/**
 * The group Activity tab tells someone outside the group that the feed is for
 * members. On orangecat.ch (2026-11-12) a signed-out visitor to a public group
 * read "Could not load activity. Try refreshing the page." and a signed-in
 * non-member "No activity yet"; neither was true. The API now answers
 * `membersOnly: true` for them (group-tabs-signed-out.test.ts).
 */
import { cleanup, render, screen } from '@testing-library/react';
import { GroupActivityFeed } from '@/components/groups/GroupActivityFeed';

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));

function answer(data: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  state.user = null;
});

it('signed out: says the feed is for members and offers sign-in back to the group', async () => {
  answer({ activities: [], membersOnly: true });
  render(<GroupActivityFeed groupSlug="bitcoin-education-foundation" />);

  expect(await screen.findByText('Activity is visible to members')).toBeInTheDocument();
  expect(screen.getByText('If you are a member, sign in to see it.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/auth?mode=login&from=%2Fgroups%2Fbitcoin-education-foundation'
  );
  expect(screen.queryByText('Could not load activity')).not.toBeInTheDocument();
  expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
});

it('signed in, not a member: says the feed is for members, not "No activity yet"', async () => {
  state.user = { id: 'visitor' };
  answer({ activities: [], membersOnly: true });
  render(<GroupActivityFeed groupSlug="zurich-record-shop" />);

  expect(await screen.findByText('Activity is visible to members')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
});

it('a member of a quiet group still reads "No activity yet"', async () => {
  state.user = { id: 'member' };
  answer({ activities: [], membersOnly: false });
  render(<GroupActivityFeed groupSlug="zurich-record-shop" />);

  expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  expect(screen.queryByText('Activity is visible to members')).not.toBeInTheDocument();
});
