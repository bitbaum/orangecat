import { GET, POST } from '@/app/api/cat/nudges/route';

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  error: null as unknown,
  eq: vi.fn(),
}));
vi.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: unknown) => handler }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: async () => ({ success: true }),
  retryAfterSeconds: () => 1,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        state.eq(...args);
        return query;
      },
      order: async () => ({ data: state.rows }),
      update: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ error: state.error }).then(resolve),
    };
    return { from: () => query };
  },
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiInternalError: (message: string) => Response.json({ message }, { status: 500 }),
  apiBadRequest: (message: string) => Response.json({ message }, { status: 400 }),
  apiRateLimited: () => Response.json({}, { status: 429 }),
}));
vi.mock('@/services/cat/nudges', () => ({ generateNudges: vi.fn() }));

const request = () => ({
  user: { id: 'owner' },
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
  json: async () => ({ action: 'dismiss', id: 'n1' }),
});
afterEach(() => {
  state.rows = [];
  state.error = null;
  state.eq.mockClear();
});
it('filters a previously cached bitcoin listing suggestion before returning it', async () => {
  state.rows = [
    { id: 'n1', dedupe_key: 'growth:asset:bitcoin', generated_at: new Date().toISOString() },
    { id: 'n2', dedupe_key: 'growth:skill:design', generated_at: new Date().toISOString() },
  ];
  const result = await GET(request() as never, {} as never);
  const body = await result.json();
  expect(body.data.cached).toBe(true);
  expect(body.data.nudges.map((n: { id: string }) => n.id)).toEqual(['n2']);
  expect(state.eq).toHaveBeenCalledWith('user_id', 'owner');
});
it('reports a failed persistence write instead of confirming a dismissal', async () => {
  state.error = { message: 'Database unavailable' };
  const result = await POST(request() as never, {} as never);
  expect(result.status).toBe(500);
  expect(state.eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(state.eq).toHaveBeenCalledWith('id', 'n1');
});
