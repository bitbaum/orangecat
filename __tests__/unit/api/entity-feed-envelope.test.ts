/**
 * Entity-feed envelope contract.
 *
 * Every feed rendered by useEntityList reads `body.data` as the ARRAY of rows
 * and `body.metadata.total` as the count. A route that wraps its own envelope
 * — `apiSuccess({ data, count })` — puts an object there instead, and the hook
 * used to assign it to `items` verbatim: the tab rendered nothing, `total` read
 * 0, and nothing was logged.
 *
 * /api/projects/favorites did exactly that, so the Projects → Favorites tab was
 * dead. Same shape and same class as the follow-list envelope behind #902.
 */

vi.mock('next/server', () => ({
  NextRequest: class NextRequest {},
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      status: (init as { status?: number })?.status ?? 200,
      headers: new Headers(init?.headers),
      json: async () => data,
    }),
    redirect: vi.fn(),
    next: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';

/** withAuth hands the handler an authenticated request; stub it with our client. */
vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown, ctx?: unknown) => Promise<Response>) =>
    (req: Record<string, unknown>, ctx?: unknown) =>
      handler({ ...req, user: { id: USER_ID }, supabase: currentClient }, ctx),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** A supabase stub whose terminal call resolves to the given rows. */
function clientReturning(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const m of ['select', 'eq', 'in', 'order', 'neq']) {
    builder[m] = vi.fn(chain);
  }
  // `await builder` — the query builder is thenable.
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: rows, error: null });
  return { from: vi.fn(() => builder) };
}

let currentClient: unknown = clientReturning([]);

describe('entity-feed envelope contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentClient = clientReturning([]);
  });

  it('favorites puts the rows in data, not in data.data', async () => {
    const { GET } = await import('@/app/api/projects/favorites/route');

    const response = await (
      GET as unknown as (r: unknown) => Promise<{ json: () => Promise<any> }>
    )({ url: 'https://orangecat.ch/api/projects/favorites' });
    const body = await response.json();

    expect(body.success).toBe(true);
    // The regression: this was `{ data: [], count: 0 }` — an object.
    expect(Array.isArray(body.data)).toBe(true);
    // And the count belongs in metadata, where useEntityList reads it.
    expect(body.data.data).toBeUndefined();
  });

  it('useEntityList reads data as the rows and metadata.total as the count', async () => {
    // The consumer contract, stated so a future route cannot quietly diverge:
    // apiSuccess(rows, { total }) -> { data: rows, metadata: { total } }
    const { apiSuccess } = await import('@/lib/api/standardResponse');
    const rows = [{ id: 'a' }, { id: 'b' }];
    const body = await apiSuccess(rows, { total: rows.length }).json();

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.metadata.total).toBe(2);
  });
});
