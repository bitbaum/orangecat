/**
 * "We could not look" is not "you have no such memory".
 *
 * Both forget stores used to swallow database errors into
 * `{ deleted: [], notFound: wanted }` — the exact shape they return when they
 * looked properly and found nothing. So:
 *
 *   * a failed SELECT told the user no such memory existed;
 *   * a failed DELETE told the user nothing matched, while the memory they had
 *     just disowned was still sitting there.
 *
 * Telling someone their data is gone when it is not is the worst thing a
 * forget feature can do, and it did it silently. bitbaum/orangecat#563
 * finding 8.
 */

import { forgetMemoriesMatching } from '@/services/cat/memory';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => false,
  embedText: vi.fn(),
  embedTexts: vi.fn(),
}));

const FACTS = ['photography skills'];
const STORED = { id: 'm1', content: 'Has photography skills from years of work' };

/**
 * Minimal Supabase stand-in: `select().eq()` resolves the load, `delete()…in()`
 * resolves the delete. Either can be told to fail.
 */
function makeClient(opts: { loadError?: unknown; deleteError?: unknown } = {}) {
  return {
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve(
            opts.loadError ? { data: null, error: opts.loadError } : { data: [STORED], error: null }
          ),
      }),
      delete: () => ({
        eq: () => ({
          in: () => Promise.resolve({ error: opts.deleteError ?? null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  } as never;
}

describe('forgetMemoriesMatching — failure is its own channel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes and reports it, when the store works', async () => {
    const result = await forgetMemoriesMatching(makeClient(), 'u1', FACTS);

    expect(result.deleted).toEqual([STORED.content]);
    expect(result.failed).toEqual([]);
    expect(result.notFound).toEqual([]);
  });

  it('does NOT claim the memory is absent when the read fails', async () => {
    const result = await forgetMemoriesMatching(
      makeClient({ loadError: { message: 'connection refused' } }),
      'u1',
      FACTS
    );

    // The bug: this used to be notFound, i.e. "you have no such memory".
    expect(result.failed).toEqual(FACTS);
    expect(result.notFound).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('does NOT claim nothing matched when the DELETE fails', async () => {
    const result = await forgetMemoriesMatching(
      makeClient({ deleteError: { message: 'deadlock detected' } }),
      'u1',
      FACTS
    );

    // We matched this memory and failed to remove it — it is still there.
    // Reporting notFound would be the exact opposite of the truth.
    expect(result.failed).toEqual([STORED.content]);
    expect(result.deleted).toEqual([]);
    expect(result.notFound).not.toContain(FACTS[0]);
  });

  it('reports a genuine miss as notFound, not as a failure', async () => {
    // The distinction has to cut both ways, or callers learn to ignore it.
    const result = await forgetMemoriesMatching(makeClient(), 'u1', ['unicycle repair']);

    expect(result.notFound).toEqual(['unicycle repair']);
    expect(result.failed).toEqual([]);
    expect(result.deleted).toEqual([]);
  });
});
