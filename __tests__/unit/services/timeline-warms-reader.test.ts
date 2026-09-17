/**
 * Every timeline read learns who is reading BEFORE it asks for the posts.
 *
 * Enrichment needs the reader's id to mark which posts they already reacted
 * to, and that id is a round-trip to /auth/v1/user. It used to be requested
 * only once the feed came back, with the three reaction queries then queued
 * behind it — three serial waves where two could overlap. Measured on a cold
 * timeline load: feed 3147-3520ms, then /auth/v1/user 3552-3784, then
 * reactions 3811-4076.
 *
 * The ordering is the whole point, so that is what these assert. A test that
 * only checked "the warm happens" would pass with the call left at the end,
 * which is the bug.
 *
 * The first version of this fix warmed inside getUserFeed — a function the
 * timeline page does not call. It went to production doing nothing. Hence the
 * table below: every read the facade exposes, not the one I happened to open.
 */

// vi.hoisted: the vi.mock factories below are hoisted above module-level
// consts, so anything they close over must be hoisted with them.
const { order, warmCurrentUserId, queries } = vi.hoisted(() => {
  const order: string[] = [];

  const warmCurrentUserId = vi.fn(() => {
    order.push('warm');
  });

  const record = (name: string) =>
    vi.fn(async () => {
      order.push(name);
      return { success: true, events: [], posts: [], replies: [], pagination: {}, total: 0 };
    });

  const queries = {
    getUserFeed: record('getUserFeed'),
    getProjectFeed: record('getProjectFeed'),
    getProfileFeed: record('getProfileFeed'),
    getFollowedUsersFeed: record('getFollowedUsersFeed'),
    getCommunityFeed: record('getCommunityFeed'),
    getEnrichedUserFeed: record('getEnrichedUserFeed'),
    getEnrichedFollowingFeed: record('getEnrichedFollowingFeed'),
    getEventById: record('getEventById'),
    getReplies: record('getReplies'),
    searchPosts: record('searchPosts'),
    getThreadPosts: record('getThreadPosts'),
  };

  return { order, warmCurrentUserId, queries };
});

vi.mock('@/services/supabase/auth/session', () => ({
  warmCurrentUserId: () => warmCurrentUserId(),
  getCurrentUserId: vi.fn(async () => 'u1'),
}));

vi.mock('@/services/timeline/queries', () => queries);

import { timelineService } from '@/services/timeline';

/** Each read, and how the facade exposes it. */
const READS: Array<[keyof typeof queries, () => Promise<unknown>]> = [
  ['getUserFeed', () => timelineService.getUserFeed('u1')],
  ['getProjectFeed', () => timelineService.getProjectFeed('p1')],
  ['getProfileFeed', () => timelineService.getProfileFeed('pr1')],
  ['getFollowedUsersFeed', () => timelineService.getFollowedUsersFeed('u1')],
  ['getCommunityFeed', () => timelineService.getCommunityFeed()],
  ['getEnrichedUserFeed', () => timelineService.getEnrichedUserFeed('u1')],
  ['getEnrichedFollowingFeed', () => timelineService.getEnrichedFollowingFeed('u1')],
  ['getEventById', () => timelineService.getEventById('e1')],
  ['getReplies', () => timelineService.getReplies('e1')],
  ['searchPosts', () => timelineService.searchPosts('cat')],
  ['getThreadPosts', () => timelineService.getThreadPosts('t1')],
];

describe('timeline reads warm the reader id first', () => {
  beforeEach(() => {
    order.length = 0;
    warmCurrentUserId.mockClear();
  });

  it.each(READS)('%s warms before it queries', async (name, call) => {
    await call();

    expect(order).toEqual(['warm', name]);
  });

  it('covers every read the facade exposes', () => {
    // If a new read is added to the service without warming, this catches it
    // even when nobody thinks to add a case above.
    const exposed = Object.getOwnPropertyNames(Object.getPrototypeOf(timelineService)).filter(
      m =>
        /^(get|search)/.test(m) &&
        m !== 'getEventCounts' &&
        m !== 'getEventComments' &&
        m !== 'getCommentReplies'
    );
    const covered = new Set(READS.map(([name]) => name as string));

    expect([...exposed].filter(m => !covered.has(m))).toEqual([]);
  });
});
