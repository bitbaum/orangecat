/**
 * Public-surface filtering contract.
 *
 * /api/v1/demand, /api/v1/search and /api/discover/counts serve the public
 * internet through the ADMIN client (RLS bypassed) — the ONLY thing keeping
 * private rows off the wire is the service-level filtering inside
 * getOpenDemand, searchPlatform and public_documents() (the SQL behind search,
 * Discover and its counts). These tests pin those predicates — by query-builder
 * inspection, or by reading the migration — so if someone removes a filter, the
 * failing assertion names the exposure.
 */

import { getOpenDemand } from '@/services/platform/demand';
import { searchPlatform } from '@/services/cat/platform-search';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchDiscoverCounts } from '@/services/search/discoverCounts';
import { FIXTURE_RPC_ARGS } from '@/services/search/public-search';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { STATUS, ENTITY_STATUS } from '@/config/database-constants';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Force searchPlatform onto its keyword path — the semantic path's guard lives
// in SQL (match_content), which unit tests can't inspect.
vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => false,
  embedText: vi.fn(),
}));

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };

/**
 * Chainable supabase mock that RECORDS every builder call per query, and
 * resolves empty data when awaited — we assert on the recorded predicates,
 * not on results.
 */
function recordingClient() {
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const query: Query = { table, calls: [] };
      queries.push(query);
      const chain: Record<string, unknown> = {};
      for (const m of [
        'select',
        'eq',
        'neq',
        'in',
        'gte',
        'lte',
        'or',
        'not',
        'order',
        'limit',
        'maybeSingle',
      ]) {
        chain[m] = (...args: unknown[]) => {
          query.calls.push({ method: m, args });
          return chain;
        };
      }
      chain.then = (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
      return chain;
    },
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  return { client: client as never, queries };
}

const queriesOn = (queries: Query[], table: string) => queries.filter(q => q.table === table);

const hasPredicate = (query: Query, method: string, args: unknown[]) =>
  query.calls.some(c => c.method === method && JSON.stringify(c.args) === JSON.stringify(args));

describe('getOpenDemand (public /api/v1/demand)', () => {
  it('only surfaces PUBLIC + ACTIVE wishlists', async () => {
    const { client, queries } = recordingClient();
    await getOpenDemand(client);

    const [wishlists] = queriesOn(queries, DATABASE_TABLES.WISHLISTS);
    expect(wishlists).toBeDefined();
    expect(hasPredicate(wishlists, 'eq', ['visibility', 'public'])).toBe(true);
    expect(hasPredicate(wishlists, 'eq', ['is_active', true])).toBe(true);
    // wishlist_items are only fetched for ids coming out of that filtered
    // query, so with zero public wishlists nothing else may be read.
    expect(queriesOn(queries, DATABASE_TABLES.WISHLIST_ITEMS)).toHaveLength(0);
  });
});

describe('searchPlatform (public /api/v1/search)', () => {
  it('filters every entity table to ACTIVE rows', async () => {
    const { client, queries } = recordingClient();
    await searchPlatform(client, 'pottery lessons', 'all');

    for (const type of ['project', 'cause', 'product', 'service', 'event'] as const) {
      const table = getTableName(type);
      const tableQueries = queriesOn(queries, table);
      expect(tableQueries.length).toBeGreaterThan(0);
      for (const q of tableQueries) {
        expect(hasPredicate(q, 'eq', ['status', ENTITY_STATUS.ACTIVE])).toBe(true);
      }
    }
  });

  it('exposes only public profile columns (username, name, bio)', async () => {
    const { client, queries } = recordingClient();
    await searchPlatform(client, 'pottery lessons', 'people');

    const [profiles] = queriesOn(queries, DATABASE_TABLES.PROFILES);
    expect(profiles).toBeDefined();
    const select = profiles.calls.find(c => c.method === 'select');
    expect(select?.args[0]).toBe('username, name, bio');
  });
});

describe('public_documents (search, Discover and /api/discover/counts)', () => {
  // Since 20261012120000 the public rules for search, Discover and the counts
  // live in ONE SQL function, run by SECURITY DEFINER callers — RLS is
  // bypassed, so these predicates are all that keeps private rows out. They
  // are pinned against the newest migration that defines the function.
  const sql = (() => {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    const file = readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .filter(f =>
        readFileSync(join(dir, f), 'utf8').includes('FUNCTION public.public_documents()')
      )
      .pop();
    const text = readFileSync(join(dir, file as string), 'utf8');
    const start = text.indexOf('FUNCTION public.public_documents()');
    return text.slice(start, text.indexOf('$$;', start));
  })();

  const branch = (table: string): string => {
    const part = sql.split('UNION ALL').find(b => b.includes(`FROM public.${table} `));
    return (part ?? '').replace(/\s+/g, ' ');
  };

  const EXPECTED: Array<{ table: string; predicates: string[] }> = [
    {
      table: getTableName('project'),
      predicates: ["x.status IN ('active','paused')", 'x.is_test IS NOT TRUE'],
    },
    {
      table: getTableName('loan'),
      predicates: ['x.is_public', "x.status = 'active'", 'x.is_test IS NOT TRUE'],
    },
    { table: getTableName('investment'), predicates: ['x.is_public', 'x.is_test IS NOT TRUE'] },
    { table: getTableName('asset'), predicates: ["x.status = 'active'", 'x.is_test IS NOT TRUE'] },
    { table: getTableName('cause'), predicates: ["x.status = 'active'", 'x.is_test IS NOT TRUE'] },
    {
      table: getTableName('event'),
      predicates: ["x.status IN ('published','open','full','ongoing')"],
    },
    {
      table: getTableName('product'),
      predicates: ["x.status = 'active'", 'x.is_test IS NOT TRUE'],
    },
    {
      table: getTableName('service'),
      predicates: ["x.status = 'active'", 'x.is_test IS NOT TRUE'],
    },
    { table: getTableName('group'), predicates: ['x.is_public IS TRUE'] },
    {
      table: getTableName('circle'),
      predicates: ["x.visibility = 'public'", "x.status = 'active'"],
    },
    {
      table: getTableName('wishlist'),
      predicates: ["x.visibility = 'public'", 'x.is_active IS TRUE'],
    },
    {
      table: getTableName('research'),
      predicates: ['x.is_public IS TRUE', "NOT IN ('draft','cancelled')"],
    },
    {
      table: getTableName('ai_assistant'),
      predicates: ['x.is_public IS TRUE', "x.status = 'active'"],
    },
  ];

  it.each(EXPECTED)('$table returns only public rows', ({ table, predicates }) => {
    const where = branch(table);
    expect(where).not.toBe('');
    for (const predicate of predicates) {
      // Failure here means search and Discover now return non-public rows of `table`.
      expect({ table, predicate, present: where.includes(predicate) }).toEqual({
        table,
        predicate,
        present: true,
      });
    }
  });

  it('every public entity type has a branch, and nothing else does', () => {
    const tables = [...sql.matchAll(/FROM public\.(\w+) /g)].map(m => m[1]).sort();
    expect(tables).toEqual([...EXPECTED.map(e => e.table), DATABASE_TABLES.PROFILES].sort());
  });
});

describe('fetchDiscoverCounts', () => {
  it('counts through public_counts with the fixture filters, per type', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { entity_type: 'project', n: '4' },
        { entity_type: 'profile', n: 9 },
      ],
      error: null,
    });
    const counts = await fetchDiscoverCounts({ rpc } as never);
    expect(rpc).toHaveBeenCalledWith('public_counts', FIXTURE_RPC_ARGS);
    expect(counts.totalProjectsCount).toBe(4);
    expect(counts.totalProfilesCount).toBe(9);
    expect(counts.totalEventsCount).toBe(0);
  });
});
