/**
 * "Search the people I follow" — search_platform / explore_topic with scope
 * "following". The contract: only the follow graph, only PUBLIC content,
 * bounded queries, an honest answer when the user follows nobody.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  formatFollowingForModel,
  isFollowingScope,
  normaliseDays,
  searchFollowing,
} from '@/services/cat/following-scope';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { recordingClient, type RecordedQuery } from './helpers/recording-client';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const ME = 'me';
const ALICE = 'alice-id';
const BOB = 'bob-id';

function graph(responses: Partial<Record<string, (q: RecordedQuery) => unknown>> = {}) {
  return recordingClient(q => {
    const custom = responses[q.table];
    if (custom) {
      return { data: custom(q) };
    }
    switch (q.table) {
      case DATABASE_TABLES.FOLLOWS:
        return { data: [{ following_id: ALICE }, { following_id: BOB }] };
      case DATABASE_TABLES.PROFILES:
        return {
          data: [
            { id: ALICE, username: 'alice', name: 'Alice', bio: 'Lightning node runner' },
            { id: BOB, username: 'bob', name: 'Bob', bio: 'Potter' },
          ],
        };
      case DATABASE_TABLES.ACTORS:
        return { data: [{ id: 'actor-alice', user_id: ALICE }] };
      case DATABASE_TABLES.TIMELINE_EVENTS:
        return {
          data: [
            {
              id: 'p1',
              actor_id: ALICE,
              title: '',
              description: 'Opened a Lightning channel today',
              event_timestamp: '2026-10-08T10:00:00+00:00',
            },
          ],
        };
      case ENTITY_REGISTRY.project.tableName:
        return {
          data: [
            {
              id: 'proj1',
              title: 'Lightning for schools',
              description: 'Teaching kids',
              actor_id: 'actor-alice',
              is_test: false,
            },
            { id: 'proj-test', title: 'Lightning test', actor_id: 'actor-alice', is_test: true },
          ],
        };
      default:
        return { data: [] };
    }
  });
}

describe('searchFollowing', () => {
  it('returns only posts and listings by followed people, attributed by handle', async () => {
    const { client, queries } = graph();
    const r = await searchFollowing(client as unknown as AnySupabaseClient, ME, 'Lightning', {
      days: 7,
    });

    expect(r.followingCount).toBe(2);
    expect(r.posts).toEqual([
      expect.objectContaining({ id: 'p1', author: '@alice', url: '/post/p1' }),
    ]);
    expect(r.entities).toEqual([
      expect.objectContaining({ id: 'proj1', owner: '@alice', entityType: 'project' }),
    ]);

    const posts = queries.find(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)!;
    // The follow graph, and only its PUBLIC, live posts.
    expect(posts.has('in', 'actor_id', [ALICE, BOB])).toBe(true);
    expect(posts.has('eq', 'visibility', 'public')).toBe(true);
    expect(posts.has('eq', 'is_deleted', false)).toBe(true);
    expect(posts.calls.some(([m, a]) => m === 'gte' && a[0] === 'event_timestamp')).toBe(true);
    expect(posts.calls.some(([m, a]) => m === 'or' && String(a[0]).includes('lightning'))).toBe(
      true
    );

    // Entities: by the followed people's actors, behind the public gate.
    const projects = queries.find(q => q.table === ENTITY_REGISTRY.project.tableName)!;
    expect(projects.has('in', 'actor_id', ['actor-alice'])).toBe(true);
    expect(projects.has('eq', 'status', 'active')).toBe(true);
  });

  it('uses a constant number of queries however many people are followed', async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ following_id: `u${i}` }));
    const { client, queries } = graph({ [DATABASE_TABLES.FOLLOWS]: () => many });
    await searchFollowing(client as unknown as AnySupabaseClient, ME, '');
    // follows + profiles + actors + posts + one per entity type (6)
    expect(queries.length).toBeLessThanOrEqual(10);
    expect(queries.filter(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)).toHaveLength(1);
  });

  it('an empty query means everything they posted — no keyword filter', async () => {
    const { client, queries } = graph();
    await searchFollowing(client as unknown as AnySupabaseClient, ME, '   ');
    const posts = queries.find(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)!;
    expect(posts.calls.some(([m]) => m === 'or')).toBe(false);
  });

  it('follows nobody → says so, and reads nothing else', async () => {
    const { client, queries } = graph({ [DATABASE_TABLES.FOLLOWS]: () => [] });
    const r = await searchFollowing(client as unknown as AnySupabaseClient, ME, 'Lightning');
    expect(r.followingCount).toBe(0);
    expect(queries.map(q => q.table)).toEqual([DATABASE_TABLES.FOLLOWS]);
    expect(formatFollowingForModel(r)).toMatch(/does not follow anyone yet/);
  });

  it('type "people" matches followed people, not the whole platform', async () => {
    const { client } = graph();
    const r = await searchFollowing(client as unknown as AnySupabaseClient, ME, 'lightning', {
      searchType: 'people',
    });
    expect(r.people.map(p => p.username)).toEqual(['alice']);
    expect(r.posts).toEqual([]);
  });

  it('never counts the user as one of their own follows', async () => {
    const { client, queries } = graph({
      [DATABASE_TABLES.FOLLOWS]: () => [{ following_id: ME }, { following_id: ALICE }],
    });
    await searchFollowing(client as unknown as AnySupabaseClient, ME, '');
    const posts = queries.find(q => q.table === DATABASE_TABLES.TIMELINE_EVENTS)!;
    expect(posts.has('in', 'actor_id', [ALICE])).toBe(true);
  });

  it('nothing matched → honest, scoped wording and a watch offer', async () => {
    const { client } = graph({
      [DATABASE_TABLES.TIMELINE_EVENTS]: () => [],
      [ENTITY_REGISTRY.project.tableName]: () => [],
    });
    const text = formatFollowingForModel(
      await searchFollowing(client as unknown as AnySupabaseClient, ME, 'Lightning', { days: 7 })
    );
    expect(text).toMatch(/only their follows were searched/);
    expect(text).toMatch(/following_topic/);
  });
});

describe('scope + window parameters', () => {
  it('reads the scope the way a model writes it', () => {
    for (const s of ['following', 'Following', 'follows', 'my_network']) {
      expect(isFollowingScope(s)).toBe(true);
    }
    for (const s of ['everyone', 'all', '', undefined, 3]) {
      expect(isFollowingScope(s)).toBe(false);
    }
  });

  it('clamps the window and ignores nonsense', () => {
    expect(normaliseDays(7)).toBe(7);
    expect(normaliseDays('7')).toBe(7);
    expect(normaliseDays(0.5)).toBe(1);
    expect(normaliseDays(10_000)).toBe(365);
    expect(normaliseDays(-3)).toBeNull();
    expect(normaliseDays('soon')).toBeNull();
    expect(normaliseDays(undefined)).toBeNull();
  });
});
