/**
 * Public-surface filtering contract.
 *
 * /api/v1/demand, /api/v1/search and /api/discover/counts serve the public
 * internet through the ADMIN client (RLS bypassed) — the ONLY thing keeping
 * private rows off the wire is the service-level filtering inside
 * getOpenDemand, searchPlatform and fetchDiscoverCounts. These tests pin those
 * predicates via query-builder inspection: if someone removes a filter, the
 * failing assertion names the exposure.
 */

import { getOpenDemand } from '@/services/platform/demand';
import { searchPlatform } from '@/services/cat/platform-search';
import { fetchDiscoverCounts } from '@/services/search/discoverCounts';
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

describe('fetchDiscoverCounts (public /api/discover/counts)', () => {
  // The public predicate set per entity table, mirroring the tab views
  // (discoverGenericFetcher.ts). Profiles are intentionally absent: the profile
  // directory is public by design (public SELECT policy on profiles).
  const EXPECTED: Array<{ table: string; predicates: Array<[string, unknown[]]> }> = [
    { table: getTableName('project'), predicates: [['eq', ['status', ENTITY_STATUS.ACTIVE]]] },
    {
      table: getTableName('loan'),
      predicates: [
        ['eq', ['is_public', true]],
        ['eq', ['status', ENTITY_STATUS.ACTIVE]],
      ],
    },
    { table: getTableName('investment'), predicates: [['eq', ['is_public', true]]] },
    { table: getTableName('asset'), predicates: [['eq', ['status', ENTITY_STATUS.ACTIVE]]] },
    { table: getTableName('cause'), predicates: [['eq', ['status', STATUS.CAUSES.ACTIVE]]] },
    {
      table: getTableName('event'),
      predicates: [
        ['in', ['status', [STATUS.EVENTS.PUBLISHED, STATUS.EVENTS.OPEN, STATUS.EVENTS.ONGOING]]],
      ],
    },
    { table: getTableName('product'), predicates: [['eq', ['status', STATUS.PRODUCTS.ACTIVE]]] },
    { table: getTableName('service'), predicates: [['eq', ['status', STATUS.SERVICES.ACTIVE]]] },
    { table: getTableName('group'), predicates: [['eq', ['is_public', true]]] },
    {
      table: getTableName('circle'),
      predicates: [
        ['eq', ['visibility', 'public']],
        ['eq', ['status', ENTITY_STATUS.ACTIVE]],
      ],
    },
    {
      table: getTableName('wishlist'),
      predicates: [
        ['eq', ['visibility', 'public']],
        ['eq', ['is_active', true]],
      ],
    },
    {
      table: getTableName('research'),
      predicates: [
        ['eq', ['is_public', true]],
        ['eq', ['status', ENTITY_STATUS.ACTIVE]],
      ],
    },
    {
      table: getTableName('ai_assistant'),
      predicates: [
        ['eq', ['is_public', true]],
        ['eq', ['status', STATUS.AI_ASSISTANTS.ACTIVE]],
      ],
    },
  ];

  it('counts only public/active rows for every entity tab', async () => {
    const { client, queries } = recordingClient();
    await fetchDiscoverCounts(client);

    for (const { table, predicates } of EXPECTED) {
      const [query] = queriesOn(queries, table);
      expect(query).toBeDefined();
      for (const [method, args] of predicates) {
        // Failure here means the count for `table` now includes non-public rows.
        expect({ table, method, args, ok: hasPredicate(query, method, args) }).toEqual({
          table,
          method,
          args,
          ok: true,
        });
      }
    }
  });
});
