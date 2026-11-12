/**
 * Every row checkHealth() reports must come from a probe.
 *
 * Production, 2026-11-12: /api/health answered
 * services.bitcoin_integration: "unknown" on every request, because the row
 * was hard-coded and nothing ever probed it. /status drew that row as a red
 * "Outage" directly under "All Systems Operational". With every dependency
 * answering, every row must read operational; a row that cannot be anything
 * else but 'unknown' is a fake metric.
 */
import { checkHealth } from '@/lib/health';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({ limit: async () => ({ data: [{ id: 'p1' }], error: null }) }),
    }),
  }),
}));

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
  globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

describe('checkHealth', () => {
  it('reports only probed services: with every dependency up, every row is operational', async () => {
    const report = await checkHealth();

    expect(report.overall).toBe('operational');
    expect(report.services.filter(s => s.status !== 'operational')).toEqual([]);
  });

  it('still reports a real auth outage', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const report = await checkHealth();

    expect(report.services).toContainEqual({ name: 'Authentication', status: 'outage' });
  });
});
