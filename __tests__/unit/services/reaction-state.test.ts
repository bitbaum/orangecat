/**
 * Reading back what was written.
 *
 * The write path was repaired first, and the like still did not appear: it was
 * in `timeline_likes`, `timeline_event_stats.like_count` read 1, and the post
 * page rendered an empty, unpressed heart. Nothing on the read side had ever
 * populated these fields — eventQueries hardcoded zeros under a comment saying
 * the UI enriched them later, and userFeeds read `event.like_count` off
 * `timeline_events`, a column that has never existed.
 *
 * So this pins the direction that had no coverage at all: counts come from the
 * stats table, "did I react" comes from the membership tables, and a signed-out
 * reader still sees the totals.
 */

import { fetchReactionState } from '@/services/timeline/processors/reaction-state';

const from = vi.fn();
vi.mock('@/services/timeline/processors/social-shared', () => ({
  db: { from: (...args: unknown[]) => from(...args) },
  getCurrentUserId: async () => 'me',
}));

/** Minimal PostgREST-ish builder: every filter returns the same thenable. */
function tableReturning(rows: unknown[]) {
  const result = Promise.resolve({ data: rows, error: null });
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'eq']) {
    chain[method] = () => chain;
  }
  chain.then = result.then.bind(result);
  return chain;
}

function withTables(tables: Record<string, unknown[]>) {
  from.mockImplementation((name: string) => tableReturning(tables[name] ?? []));
}

describe('fetchReactionState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads counts from the stats table, not from timeline_events', async () => {
    withTables({
      timeline_event_stats: [
        { event_id: 'e1', like_count: 4, dislike_count: 1, comment_count: 2, share_count: 3 },
      ],
      timeline_likes: [],
      timeline_dislikes: [],
    });

    const state = await fetchReactionState(['e1'], 'me');

    expect(state.get('e1')).toMatchObject({
      likesCount: 4,
      dislikesCount: 1,
      commentsCount: 2,
      sharesCount: 3,
    });
  });

  it('marks the posts this reader has liked', async () => {
    withTables({
      timeline_event_stats: [{ event_id: 'e1', like_count: 1 }],
      timeline_likes: [{ event_id: 'e1' }],
      timeline_dislikes: [],
    });

    const state = await fetchReactionState(['e1', 'e2'], 'me');

    expect(state.get('e1')?.userLiked).toBe(true);
    // e2 has no rows anywhere, and must still be present rather than missing —
    // a caller looking it up should get zeros, not undefined.
    expect(state.get('e2')).toMatchObject({ userLiked: false, likesCount: 0 });
  });

  it('still returns public totals for a signed-out reader', async () => {
    withTables({
      timeline_event_stats: [{ event_id: 'e1', like_count: 9 }],
      timeline_likes: [],
      timeline_dislikes: [],
    });

    const state = await fetchReactionState(['e1'], null);

    expect(state.get('e1')).toMatchObject({ likesCount: 9, userLiked: false });
  });

  it('asks for nothing when there are no events', async () => {
    withTables({});
    await expect(fetchReactionState([], 'me')).resolves.toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
  });
});
