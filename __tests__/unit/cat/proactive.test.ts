import { composeDailyBrief, runDailyBrief, runWatchEvaluation } from '@/services/cat/proactive';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Daily brief + watch evaluation — the proactive layer. The contract under
 * test: a brief only exists when there is something to say, it is idempotent
 * per day, and a watch fires exactly once (marked fired BEFORE notifying).
 */

const createNotificationMock = vi.fn().mockResolvedValue({ success: true, notificationId: 'n1' });
vi.mock('@/lib/services/notifications', () => ({
  // function (not arrow): vitest constructs mock implementations with `new`.
  NotificationService: vi.fn().mockImplementation(function () {
    return {
      createNotification: (...args: unknown[]) => createNotificationMock(...args),
    };
  }),
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

type QueryResponse = { data?: unknown; error?: unknown; count?: number | null };

function mockAdmin(queues: Record<string, QueryResponse[]>) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of [
        'select',
        'eq',
        'in',
        'gt',
        'gte',
        'lt',
        'lte',
        'order',
        'limit',
        'single',
      ]) {
        builder[m] = chain;
      }
      builder.update = (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return builder;
      };
      builder.then = (resolve: (v: QueryResponse) => void) => {
        const queue = queues[table] ?? [];
        const next = queue.length > 0 ? queue.shift()! : { data: [], error: null, count: 0 };
        resolve({ data: next.data ?? [], error: next.error ?? null, count: next.count ?? null });
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, updates };
}

beforeEach(() => {
  createNotificationMock.mockClear();
});

describe('composeDailyBrief', () => {
  it('summarizes sales, bookings, overdue tasks, and unread notifications', async () => {
    const { client } = mockAdmin({
      actors: [{ data: [{ id: 'a1' }] }],
      orders: [{ data: [{ amount_btc: 0.001 }, { amount_btc: 0.002 }] }],
      tasks: [{ data: [{ title: 'Ship the mug' }] }],
      notifications: [{ data: [], count: 4 }],
      bookings: [{ data: [{ starts_at: '2099-01-01' }] }],
    });
    const brief = await composeDailyBrief(client, 'u1');
    expect(brief).toContain('2 sales (0.003 BTC)');
    expect(brief).toContain('1 booking in the next 48h');
    expect(brief).toContain('1 task overdue (first: "Ship the mug")');
    expect(brief).toContain('4 unread notifications');
  });

  it('returns null when there is nothing to say (no spam)', async () => {
    const { client } = mockAdmin({ actors: [{ data: [] }] });
    expect(await composeDailyBrief(client, 'u1')).toBeNull();
  });
});

describe('runDailyBrief', () => {
  it('sends at most one brief per user per day', async () => {
    const { client } = mockAdmin({
      cat_messages: [{ data: [{ user_id: 'u1' }, { user_id: 'u1' }] }],
      // briefAlreadySentToday: an existing cat_brief notification today
      notifications: [{ data: [{ id: 'existing' }] }],
    });
    const result = await runDailyBrief(client, 50);
    expect(result.usersConsidered).toBe(1);
    expect(result.briefsSent).toBe(0);
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('sends the brief when signals exist and none was sent today', async () => {
    const { client } = mockAdmin({
      cat_messages: [{ data: [{ user_id: 'u1' }] }],
      notifications: [
        { data: [] }, // dedupe check: nothing today
        { data: [], count: 2 }, // unread count in compose
      ],
      actors: [{ data: [] }],
      orders: [{ data: [{ amount_btc: 0.001 }] }],
      tasks: [{ data: [] }],
    });
    const result = await runDailyBrief(client, 50);
    expect(result.briefsSent).toBe(1);
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'u1',
        actionUrl: '/dashboard/cat',
        metadata: { kind: 'cat_brief' },
      })
    );
  });
});

describe('runWatchEvaluation', () => {
  const fundingWatch = {
    id: 'w1',
    user_id: 'u1',
    kind: 'funding_reached',
    label: 'Project hit 0.05 BTC!',
    entity_type: 'project',
    entity_id: 'e1',
    target_btc: 0.05,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('fires a funding watch when settled payments reach the target', async () => {
    const { client, updates } = mockAdmin({
      cat_watches: [{ data: [fundingWatch] }],
      payment_intents: [{ data: [{ amount_btc: 0.03 }, { amount_btc: 0.025 }] }],
    });
    const result = await runWatchEvaluation(client);
    expect(result.fired).toBe(1);
    // fired BEFORE notifying — the status update must exist
    expect(updates).toEqual([
      expect.objectContaining({
        table: 'cat_watches',
        values: expect.objectContaining({ status: 'fired' }),
      }),
    ]);
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'u1',
        message: '👁️ Project hit 0.05 BTC!',
        metadata: expect.objectContaining({ kind: 'cat_watch', watchId: 'w1' }),
      })
    );
  });

  it('does not fire below the target', async () => {
    const { client } = mockAdmin({
      cat_watches: [{ data: [fundingWatch] }],
      payment_intents: [{ data: [{ amount_btc: 0.01 }] }],
    });
    const result = await runWatchEvaluation(client);
    expect(result.fired).toBe(0);
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('fires a sale watch only when a paid order arrived after the watch was created', async () => {
    const saleWatch = {
      ...fundingWatch,
      id: 'w2',
      kind: 'sale_received',
      label: 'You made a sale!',
      entity_id: null,
      target_btc: null,
    };
    const { client } = mockAdmin({
      cat_watches: [{ data: [saleWatch] }],
      orders: [{ data: [{ id: 'o1' }] }],
    });
    const result = await runWatchEvaluation(client);
    expect(result.fired).toBe(1);
  });
});
