/**
 * pruneAbandonedDcrClients — the daily sweep behind /oauth/register.
 *
 * Anyone can register a client, so rows accumulate from probes and from
 * connector sign-ins that were started and never finished. The sweep must
 * delete exactly those and nothing else: a client with a grant (someone
 * consented) or a live refresh token is in use at any age, and a client the
 * operator registered by hand is never touched, however old and unused.
 */
const { state, chain } = vi.hoisted(() => {
  type Row = { client_id: string };
  const state = {
    stale: [] as Row[],
    grants: [] as Row[],
    tokens: [] as Row[],
    deletedIds: null as string[] | null,
    deleteFilters: [] as Array<[string, unknown]>,
    listError: null as { message: string } | null,
  };
  function chain(table: string) {
    let op: 'select' | 'delete' = 'select';
    let inIds: string[] = [];
    const b: Record<string, unknown> = {};
    const self = () => b;
    for (const m of ['select', 'lt', 'limit', 'is']) b[m] = self;
    b.eq = (col: string, value: unknown) => {
      if (op === 'delete') state.deleteFilters.push([col, value]);
      return b;
    };
    b.delete = () => {
      op = 'delete';
      return b;
    };
    b.in = (_col: string, ids: string[]) => {
      inIds = ids;
      return b;
    };
    b.then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown
    ): Promise<unknown> => {
      let out: unknown;
      if (op === 'delete') {
        state.deletedIds = inIds;
        out = { count: inIds.length, error: null };
      } else if (table === 'oauth_clients') {
        out = { data: state.stale, error: state.listError };
      } else if (table === 'oauth_user_grants') {
        out = { data: state.grants.filter(r => inIds.includes(r.client_id)), error: null };
      } else {
        out = { data: state.tokens.filter(r => inIds.includes(r.client_id)), error: null };
      }
      return Promise.resolve(out).then(resolve, reject);
    };
    return b;
  }
  return { state, chain };
});

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => chain(table) }),
}));

import { pruneAbandonedDcrClients } from '@/services/auth/oauthRegistration';

beforeEach(() => {
  state.stale = [];
  state.grants = [];
  state.tokens = [];
  state.deletedIds = null;
  state.deleteFilters = [];
  state.listError = null;
});

describe('pruneAbandonedDcrClients', () => {
  it('deletes nothing and issues no delete when no self-registered client is old enough', async () => {
    expect(await pruneAbandonedDcrClients()).toBe(0);
    expect(state.deletedIds).toBeNull();
  });

  it('deletes old self-registered clients nobody consented to', async () => {
    state.stale = [{ client_id: 'dcr_a' }, { client_id: 'dcr_b' }];
    expect(await pruneAbandonedDcrClients()).toBe(2);
    expect(state.deletedIds).toEqual(['dcr_a', 'dcr_b']);
  });

  it('keeps a client that holds a grant or a live refresh token', async () => {
    state.stale = [{ client_id: 'dcr_a' }, { client_id: 'dcr_b' }, { client_id: 'dcr_c' }];
    state.grants = [{ client_id: 'dcr_a' }];
    state.tokens = [{ client_id: 'dcr_b' }];
    expect(await pruneAbandonedDcrClients()).toBe(1);
    expect(state.deletedIds).toEqual(['dcr_c']);
  });

  it('issues no delete at all when every old client is in use', async () => {
    state.stale = [{ client_id: 'dcr_a' }];
    state.grants = [{ client_id: 'dcr_a' }];
    expect(await pruneAbandonedDcrClients()).toBe(0);
    expect(state.deletedIds).toBeNull();
  });

  it('the delete itself is fenced to self-registered rows, not only the id list', async () => {
    // Belt and braces: even if the id list were wrong, the DELETE cannot
    // reach a client the operator registered.
    state.stale = [{ client_id: 'dcr_a' }];
    await pruneAbandonedDcrClients();
    expect(state.deleteFilters).toContainEqual(['registered_via', 'dcr']);
  });

  it('throws (so the cron reports an error, not a silent 0) when the listing fails', async () => {
    state.listError = { message: 'connection_reset' };
    await expect(pruneAbandonedDcrClients()).rejects.toThrow(/connection_reset/);
    expect(state.deletedIds).toBeNull();
  });
});
