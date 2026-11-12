/**
 * The sitemap is prerendered at build time and reads the database for its
 * profile, entity and article URLs. A database that does not answer must cost
 * that generation those URLs, never the build: Next gives a prerendered route
 * 60 s, three times, then fails the whole export. On 2026-11-12, with the
 * self-hosted box out of memory, every CI build died on /sitemap.xml this way.
 */

const logError = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: (...args: unknown[]) => logError(...args), info: vi.fn() },
}));

vi.mock('@/lib/blog', () => ({
  getPublishedPosts: () => [{ slug: 'hello', date: '2026-11-01' }],
}));

// 'hang' = the database never answers; 'answer' = it answers at once.
let mode: 'hang' | 'answer' = 'hang';

function query(rows: unknown[]) {
  const settled =
    mode === 'hang' ? new Promise(() => {}) : Promise.resolve({ data: rows, error: null });
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self,
    eq: self,
    not: self,
    then: settled.then.bind(settled),
  });
  return chain;
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/supabase/untyped', () => ({
  looseClient: () => ({
    from: (table: string) =>
      query(
        table === 'profiles'
          ? [{ username: 'ada', updated_at: '2026-11-10T00:00:00Z' }]
          : [{ id: `${table}-1`, updated_at: '2026-11-10T00:00:00Z' }]
      ),
  }),
}));
vi.mock('@/services/articles/get-article', () => ({
  listPublicArticleRefs: () =>
    mode === 'hang'
      ? new Promise(() => {})
      : Promise.resolve([{ slug: 'first-light', publishedAt: '2026-11-09T00:00:00Z' }]),
}));

import sitemap from '@/app/sitemap';

const urls = (entries: { url: string }[]) => entries.map(e => new URL(e.url).pathname);

describe('the sitemap does not wait on a database that does not answer', () => {
  beforeEach(() => {
    logError.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a hanging database costs the DB-backed URLs within 15 s, not the build', async () => {
    mode = 'hang';
    let done = false;
    const result = sitemap().then(r => {
      done = true;
      return r;
    });

    await vi.advanceTimersByTimeAsync(14_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    const paths = urls(await result);

    expect(paths).toContain('/discover');
    expect(paths).toContain('/blog/hello');
    expect(paths.some(p => p.startsWith('/profiles/'))).toBe(false);
    expect(paths.some(p => p.startsWith('/articles/first-light'))).toBe(false);

    const messages = logError.mock.calls.map(c => String(c[0]));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('article URLs omitted'),
        expect.stringContaining('dynamic URLs omitted'),
      ])
    );
  });

  it('a database that answers still gives every URL, with nothing logged', async () => {
    mode = 'answer';
    const paths = urls(await sitemap());

    expect(paths).toContain('/profiles/ada');
    expect(paths).toContain('/articles/first-light');
    expect(paths.filter(p => /^\/[a-z-]+\/[a-z_]+-1$/.test(p)).length).toBeGreaterThan(5);
    expect(logError).not.toHaveBeenCalled();
  });
});
