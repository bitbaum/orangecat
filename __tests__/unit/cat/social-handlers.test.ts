import { socialHandlers } from '@/services/cat/handlers/social';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * Demand-side verbs: follow/unfollow resolve @usernames and never double-act;
 * like_post dedupes; mark_notifications_read reports the real count. Booking
 * verbs delegate to the booking service (integration-tested there).
 */

const getUnreadCountMock = vi.fn();
const markAllAsReadMock = vi.fn();
vi.mock('@/lib/services/notifications', () => ({
  // function (not arrow): vitest constructs mock implementations with `new`.
  NotificationService: vi.fn().mockImplementation(function () {
    return {
      getUnreadCount: (...args: unknown[]) => getUnreadCountMock(...args),
      markAllAsRead: (...args: unknown[]) => markAllAsReadMock(...args),
    };
  }),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

type QueryResponse = { data?: unknown; error?: unknown };

function mockSupabase(queues: Record<string, QueryResponse[]>) {
  const inserted: Record<string, unknown[]> = {};
  const deletedFrom: string[] = [];
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ['select', 'eq', 'order', 'limit']) {
        builder[m] = chain;
      }
      builder.maybeSingle = () => {
        const queue = queues[table] ?? [];
        const next = queue.length > 0 ? queue.shift()! : { data: null, error: null };
        return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
      };
      builder.insert = (values: unknown) => {
        inserted[table] = [...(inserted[table] ?? []), values];
        return Promise.resolve({ error: null });
      };
      builder.delete = () => {
        deletedFrom.push(table);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      };
      builder.then = (resolve: (v: QueryResponse) => void) => {
        const queue = queues[table] ?? [];
        const next = queue.length > 0 ? queue.shift()! : { data: [], error: null };
        resolve({ data: next.data ?? [], error: next.error ?? null });
      };
      return builder;
    },
  } as unknown as AnySupabaseClient;
  return { client, inserted, deletedFrom };
}

beforeEach(() => {
  getUnreadCountMock.mockReset();
  markAllAsReadMock.mockReset();
});

describe('follow_user', () => {
  it('resolves the @username, follows, and reports it', async () => {
    const { client, inserted } = mockSupabase({
      profiles: [
        { data: { id: 'target-1', username: 'alice', name: 'Alice' } },
        { data: { id: 'me', username: 'mao', name: 'Mao' } },
      ],
      follows: [{ data: null }], // not yet following
    });
    const result = await socialHandlers.follow_user(client, 'me', 'actor-1', {
      username: '@alice',
    });
    expect(result.success).toBe(true);
    expect((result.data as { displayMessage: string }).displayMessage).toBe(
      '➕ Now following @alice'
    );
    expect(inserted.follows).toEqual([{ follower_id: 'me', following_id: 'target-1' }]);
  });

  it('refuses to follow yourself or an unknown user', async () => {
    const { client } = mockSupabase({ profiles: [{ data: null }] });
    const unknown = await socialHandlers.follow_user(client, 'me', 'a', { username: 'ghost' });
    expect(unknown.success).toBe(false);

    const { client: client2 } = mockSupabase({
      profiles: [{ data: { id: 'me', username: 'mao', name: null } }],
    });
    const self = await socialHandlers.follow_user(client2, 'me', 'a', { username: 'mao' });
    expect(self.success).toBe(false);
    expect(self.error).toContain('yourself');
  });

  it('reports an existing follow instead of double-inserting', async () => {
    const { client, inserted } = mockSupabase({
      profiles: [{ data: { id: 'target-1', username: 'alice', name: null } }],
      follows: [{ data: { id: 'f1' } }],
    });
    const result = await socialHandlers.follow_user(client, 'me', 'a', { username: 'alice' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already following');
    expect(inserted.follows).toBeUndefined();
  });
});

describe('unfollow_user', () => {
  it('deletes the follow row when it exists', async () => {
    const { client, deletedFrom } = mockSupabase({
      profiles: [{ data: { id: 'target-1', username: 'alice', name: null } }],
      follows: [{ data: { id: 'f1' } }],
    });
    const result = await socialHandlers.unfollow_user(client, 'me', 'a', { username: 'alice' });
    expect(result.success).toBe(true);
    expect(deletedFrom).toContain('follows');
  });
});

describe('like_post', () => {
  it('likes once and refuses a duplicate', async () => {
    const { client, inserted } = mockSupabase({ timeline_likes: [{ data: null }] });
    const first = await socialHandlers.like_post(client, 'me', 'a', { post_id: 'p1' });
    expect(first.success).toBe(true);
    expect(inserted.timeline_likes).toHaveLength(1);

    const { client: client2, inserted: inserted2 } = mockSupabase({
      timeline_likes: [{ data: { id: 'l1' } }],
    });
    const second = await socialHandlers.like_post(client2, 'me', 'a', { post_id: 'p1' });
    expect(second.success).toBe(false);
    expect(inserted2.timeline_likes).toBeUndefined();
  });
});

describe('mark_notifications_read', () => {
  it('reports the number actually cleared', async () => {
    getUnreadCountMock.mockResolvedValue(3);
    markAllAsReadMock.mockResolvedValue(true);
    const { client } = mockSupabase({});
    const result = await socialHandlers.mark_notifications_read(client, 'me', 'a', {});
    expect(result.success).toBe(true);
    expect((result.data as { displayMessage: string }).displayMessage).toContain('3 notifications');
  });

  it('is honest when there is nothing to clear', async () => {
    getUnreadCountMock.mockResolvedValue(0);
    const { client } = mockSupabase({});
    const result = await socialHandlers.mark_notifications_read(client, 'me', 'a', {});
    expect(result.success).toBe(true);
    expect(markAllAsReadMock).not.toHaveBeenCalled();
  });
});
