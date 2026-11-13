/**
 * "Export my data" promises "the data we store about you". On 2026-11-12 the
 * file held ten tables (profile, Cat history, credits, preferences, sent
 * messages) and nothing the person had made: no pages, wallets, posts,
 * follows, memberships or payments.
 */
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { DATABASE_TABLES, WALLET_CLIENT_COLUMNS } from '@/config/database-tables';

vi.mock('@/domain/actors', () => ({ getUserActorIds: async () => ['actor-1'] }));

import { exportAccount } from '@/domain/account/exportAccount';

type Call = { table: string; select: string; filter: string };

function fakeClient(calls: Call[]) {
  return {
    from(table: string) {
      const call: Call = { table, select: '', filter: '' };
      calls.push(call);
      const chain = {
        select(cols: string) {
          call.select = cols;
          return chain;
        },
        in(column: string, ids: string[]) {
          call.filter = `${column} in ${ids.join(',')}`;
          return Promise.resolve({ data: [{ table }], error: null });
        },
        or(expr: string) {
          call.filter = `or ${expr}`;
          return Promise.resolve({ data: [{ table }], error: null });
        },
      };
      return chain;
    },
  };
}

describe('exportAccount', () => {
  it('includes every page the person owns, found through the registry', async () => {
    const calls: Call[] = [];
    const file = await exportAccount(fakeClient(calls) as never, 'user-1');

    for (const type of ENTITY_TYPES) {
      const meta = ENTITY_REGISTRY[type];
      const owner = meta.userIdField === 'actor_id' ? 'actor-1' : 'user-1';
      expect(calls).toContainEqual(
        expect.objectContaining({
          table: meta.tableName,
          filter: `${meta.userIdField} in ${owner}`,
        })
      );
      expect(file.pages[type]).toEqual([{ table: meta.tableName }]);
    }
  });

  it('reads wallets without the connection secret', async () => {
    const calls: Call[] = [];
    await exportAccount(fakeClient(calls) as never, 'user-1');
    const wallets = calls.find(c => c.table === DATABASE_TABLES.WALLETS);
    expect(wallets?.select).toBe(WALLET_CLIENT_COLUMNS);
    expect(wallets?.select).not.toContain('nwc');
  });

  it('includes posts, follows, memberships, payments and notifications', async () => {
    const calls: Call[] = [];
    const file = await exportAccount(fakeClient(calls) as never, 'user-1');
    const filters = Object.fromEntries(calls.map(c => [c.table, c.filter]));

    expect(filters[DATABASE_TABLES.TIMELINE_EVENTS]).toBe('actor_id in user-1,actor-1');
    expect(filters[DATABASE_TABLES.FOLLOWS]).toBe(
      'or follower_id.eq.user-1,following_id.eq.user-1'
    );
    expect(filters[DATABASE_TABLES.GROUP_MEMBERS]).toBe('user_id in user-1');
    expect(filters[DATABASE_TABLES.PAYMENT_REQUESTS]).toBe(
      'or requester_id.eq.user-1,payer_id.eq.user-1'
    );
    expect(filters[DATABASE_TABLES.ORDERS]).toBe('or buyer_id.eq.user-1,seller_id.eq.user-1');
    expect(filters[DATABASE_TABLES.NOTIFICATIONS]).toBe('user_id in user-1');
    for (const key of ['posts', 'follows', 'group_memberships', 'payment_requests', 'orders']) {
      expect(file).toHaveProperty(key);
    }
  });

  it('leaves the embedding vectors out of memories and interests', async () => {
    const calls: Call[] = [];
    await exportAccount(fakeClient(calls) as never, 'user-1');
    for (const table of [DATABASE_TABLES.CAT_MEMORIES, DATABASE_TABLES.CAT_INTERESTS]) {
      expect(calls.find(c => c.table === table)?.select).not.toMatch(/embedding|\*/);
    }
  });

  it('refuses to hand over a partial file when a read fails', async () => {
    const failing = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
          or: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
    await expect(exportAccount(failing as never, 'user-1')).rejects.toThrow(/Export failed/);
  });
});
