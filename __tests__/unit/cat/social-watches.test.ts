/**
 * Watches on people — person_posts and following_topic. The contract under
 * test: a post fires a watch at most ONCE (the cursor moves before the
 * notification), posts at or before the cursor are never re-judged, only
 * people in scope count, only public posts are read, and the timer's cost does
 * not grow with the number of watches.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import {
  evaluateSocialWatches,
  shouldCatchUpIdle,
  type SocialWatchRow,
} from '@/services/cat/social-watches';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordingClient, type RecordedQuery } from './helpers/recording-client';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const T0 = '2026-10-09T08:00:00+00:00';
const T1 = '2026-10-09T09:00:00+00:00';
const T2 = '2026-10-09T10:00:00+00:00';
const T3 = '2026-10-09T11:00:00+00:00';

const watch = (over: Partial<SocialWatchRow>): SocialWatchRow => ({
  id: 'w1',
  user_id: 'me',
  kind: 'person_posts',
  label: 'Alice posted',
  topic: null,
  subject_user_id: 'alice',
  last_seen_at: T0,
  created_at: T0,
  ...over,
});

const post = (id: string, actor: string, at: string, text: string) => ({
  id,
  actor_id: actor,
  title: '',
  description: text,
  created_at: at,
});

interface World {
  posts: ReturnType<typeof post>[];
  follows?: Array<{ follower_id: string; following_id: string }>;
  /** Cursor rows the database holds (id → last_seen_at), for the compare-and-set. */
  cursors: Map<string, string | null>;
}

function world(w: World) {
  const notify = vi.fn().mockResolvedValue({ success: true });
  const { client, queries } = recordingClient((q: RecordedQuery) => {
    if (q.table === DATABASE_TABLES.FOLLOWS) {
      return { data: w.follows ?? [] };
    }
    if (q.table === DATABASE_TABLES.PROFILES) {
      return {
        data: [
          { id: 'alice', username: 'alice', name: 'Alice' },
          { id: 'bob', username: 'bob', name: 'Bob' },
        ],
      };
    }
    if (q.table === DATABASE_TABLES.TIMELINE_EVENTS) {
      const authors = (q.calls.find(([m, a]) => m === 'in' && a[0] === 'actor_id')?.[1][1] ??
        []) as string[];
      const since = q.calls.find(([m, a]) => m === 'gt' && a[0] === 'created_at')?.[1][1] as string;
      return {
        data: w.posts
          .filter(p => authors.includes(p.actor_id) && p.created_at > since)
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
      };
    }
    if (q.table === DATABASE_TABLES.CAT_WATCHES && q.write?.op === 'update') {
      // compare-and-set on the cursor, like the real row would behave
      const id = q.calls.find(([m, a]) => m === 'eq' && a[0] === 'id')?.[1][1] as string;
      const expected = q.calls.find(
        ([m, a]) => (m === 'eq' || m === 'is') && a[0] === 'last_seen_at'
      )?.[1][1] as string | null;
      if ((w.cursors.get(id) ?? null) !== (expected ?? null)) {
        return { data: [] };
      }
      w.cursors.set(id, q.write.values.last_seen_at as string);
      return { data: [{ id }] };
    }
    return { data: [] };
  });
  return { client: client as unknown as SupabaseClient, queries, notify };
}

/** Run the timer the way the cron does: re-reading each watch's cursor. */
async function tick(w: World, watches: SocialWatchRow[]) {
  const env = world(w);
  const rows = watches.map(x => ({ ...x, last_seen_at: w.cursors.get(x.id) ?? x.last_seen_at }));
  const result = await evaluateSocialWatches(env.client, rows, { createNotification: env.notify });
  return { ...env, result };
}

describe('person_posts', () => {
  it('fires once for a new post, and not again on the next run', async () => {
    const w: World = {
      posts: [post('p1', 'alice', T1, 'hello world')],
      cursors: new Map([['w1', T0]]),
    };
    const first = await tick(w, [watch({})]);
    expect(first.result.fired).toBe(1);
    expect(first.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'me',
        actionUrl: '/post/p1',
        message: expect.stringContaining('@alice'),
        metadata: expect.objectContaining({ watchKind: 'person_posts', postIds: ['p1'] }),
      })
    );
    expect(w.cursors.get('w1')).toBe(T1);

    const second = await tick(w, [watch({})]);
    expect(second.result.fired).toBe(0);
    expect(second.notify).not.toHaveBeenCalled();
  });

  it('respects the cursor: posts at or before it are never judged', async () => {
    const w: World = {
      posts: [post('old', 'alice', T0, 'old news'), post('new', 'alice', T2, 'fresh')],
      cursors: new Map([['w1', T1]]),
    };
    const { notify } = await tick(w, [watch({ last_seen_at: T1 })]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].metadata.postIds).toEqual(['new']);
  });

  it('ignores everyone else', async () => {
    const w: World = {
      posts: [post('p1', 'bob', T1, 'hello')],
      cursors: new Map([['w1', T0]]),
    };
    const { result, queries } = await tick(w, [watch({})]);
    expect(result.fired).toBe(0);
    const read = queries.find(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)!;
    expect(read.has('in', 'actor_id', ['alice'])).toBe(true);
  });

  it('reads only public, live posts', async () => {
    const w: World = { posts: [], cursors: new Map([['w1', T0]]) };
    const { queries } = await tick(w, [watch({})]);
    const read = queries.find(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)!;
    expect(read.has('eq', 'visibility', 'public')).toBe(true);
    expect(read.has('eq', 'is_deleted', false)).toBe(true);
  });

  it('with a keyword: a non-matching post moves the cursor but notifies nothing', async () => {
    const w: World = {
      posts: [post('p1', 'alice', T1, 'my cat is cute'), post('p2', 'alice', T2, 'cats again')],
      cursors: new Map([['w1', T0]]),
    };
    const first = await tick(w, [watch({ topic: 'Lightning' })]);
    expect(first.notify).not.toHaveBeenCalled();
    expect(w.cursors.get('w1')).toBe(T2);

    w.posts.push(post('p3', 'alice', T3, 'Opened a Lightning channel'));
    const second = await tick(w, [watch({ topic: 'Lightning' })]);
    expect(second.notify).toHaveBeenCalledTimes(1);
    expect(second.notify.mock.calls[0][0].metadata.postIds).toEqual(['p3']);
  });

  it('a concurrent run that already moved the cursor owns the notification', async () => {
    const w: World = {
      posts: [post('p1', 'alice', T1, 'hello')],
      // The row already says T1 — another run got there first.
      cursors: new Map([['w1', T1]]),
    };
    const env = world(w);
    const result = await evaluateSocialWatches(env.client, [watch({ last_seen_at: T0 })], {
      createNotification: env.notify,
    });
    expect(result.fired).toBe(0);
    expect(env.notify).not.toHaveBeenCalled();
  });

  it('never watches the watcher', async () => {
    const w: World = {
      posts: [post('p1', 'me', T1, 'my own post')],
      cursors: new Map([['w1', T0]]),
    };
    const { result, queries } = await tick(w, [watch({ subject_user_id: 'me' })]);
    expect(result.fired).toBe(0);
    expect(queries.some(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)).toBe(false);
  });
});

describe('following_topic', () => {
  const topicWatch = watch({
    id: 'w2',
    kind: 'following_topic',
    label: 'People you follow posted about Lightning',
    topic: 'Lightning',
    subject_user_id: null,
  });

  it('fires for a followed person posting on the topic, and only them', async () => {
    const w: World = {
      follows: [{ follower_id: 'me', following_id: 'alice' }],
      posts: [
        post('p1', 'alice', T1, 'Lightning is fast'),
        post('p2', 'bob', T1, 'Lightning everywhere'), // not followed
      ],
      cursors: new Map([['w2', T0]]),
    };
    const { result, notify, queries } = await tick(w, [topicWatch]);
    expect(result.fired).toBe(1);
    expect(notify.mock.calls[0][0].metadata.postIds).toEqual(['p1']);
    const read = queries.find(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)!;
    expect(read.has('in', 'actor_id', ['alice'])).toBe(true);
  });

  it('ignores followed people posting about something else', async () => {
    const w: World = {
      follows: [{ follower_id: 'me', following_id: 'alice' }],
      posts: [post('p1', 'alice', T1, 'Pottery class tonight')],
      cursors: new Map([['w2', T0]]),
    };
    const { result } = await tick(w, [topicWatch]);
    expect(result.fired).toBe(0);
  });

  it('follows nobody → reads no posts at all', async () => {
    const w: World = { follows: [], posts: [], cursors: new Map([['w2', T0]]) };
    const { queries } = await tick(w, [topicWatch]);
    expect(queries.some(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)).toBe(false);
  });
});

describe('cost', () => {
  it('a constant number of reads, however many watches', async () => {
    const watches = Array.from({ length: 50 }, (_, i) =>
      watch({ id: `w${i}`, subject_user_id: i % 2 ? 'alice' : 'bob' })
    );
    const w: World = {
      posts: [post('p1', 'alice', T1, 'hi'), post('p2', 'bob', T1, 'hey')],
      cursors: new Map(watches.map(x => [x.id, T0])),
    };
    const { queries, result } = await tick(w, watches);
    expect(result.fired).toBe(50);
    const reads = queries.filter(q => !q.write);
    // one posts read, one profiles read — no per-watch reads
    expect(reads.filter(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)).toHaveLength(1);
    expect(reads.filter(q => q.table === DATABASE_TABLES.PROFILES)).toHaveLength(1);
  });
});

describe('shouldCatchUpIdle', () => {
  it('catches an idle cursor up when the read was truncated, or once a day', () => {
    const now = '2026-10-09T12:00:00.000Z';
    expect(shouldCatchUpIdle('2026-10-09T11:00:00+00:00', now, true)).toBe(true);
    expect(shouldCatchUpIdle('2026-10-09T11:00:00+00:00', now, false)).toBe(false);
    expect(shouldCatchUpIdle('2026-10-07T11:00:00+00:00', now, false)).toBe(true);
    // never backwards
    expect(shouldCatchUpIdle('2026-10-09T13:00:00+00:00', now, true)).toBe(false);
  });
});
