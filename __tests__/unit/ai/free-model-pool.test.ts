/**
 * The free pool is resolved from OpenRouter rather than remembered from a file.
 *
 * The tests that matter are the ones where getting it wrong costs a user their
 * answer: resolution failing must change nothing, discovery must never displace
 * the model the auto-router chose, and the chain must never come back empty.
 *
 * These drive the REAL registry ids on purpose. An earlier draft used invented
 * ones and a drop assertion failed — correctly: resolution declares
 * `getFreeModels()`, so an id that was never declared cannot be "retired", and
 * the module passes it through rather than judging it. Using the real ids tests
 * the coupling that actually exists in production instead of a fiction.
 *
 * Resolution runs in the background, so each test drives it deterministically
 * rather than racing a timer.
 */
import { resolveFreePool, freePoolStatus, __resetFreePool } from '@/services/ai/free-model-pool';
import { getFreeModels } from '@/config/ai-models';

const REGISTRY = getFreeModels().map(m => m.id);

/** Serve one OpenRouter-shaped catalogue body. */
function serveCatalogue(ids: Array<{ id: string; free?: boolean; tools?: boolean }>) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: ids.map(m => ({
        id: m.id,
        architecture: { output_modalities: ['text'] },
        pricing:
          m.free === false
            ? { prompt: '0.000001', completion: '0.000001' }
            : { prompt: '0', completion: '0' },
        supported_parameters: m.tools === false ? ['temperature'] : ['tools'],
        context_length: 100000,
      })),
    }),
  }));
}

/** Let the fire-and-forget refresh settle. */
async function settle(): Promise<void> {
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

describe('the free pool follows the vendor, not the file', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    __resetFreePool();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = realFetch;
    __resetFreePool();
  });

  it('has real registry ids to work with', () => {
    // Guards every test below: an empty registry would make them vacuous.
    expect(REGISTRY.length).toBeGreaterThan(1);
  });

  it('returns the registry list before anything has resolved', () => {
    // The cold-start contract: never worse than today, never blocking.
    global.fetch = serveCatalogue(REGISTRY.map(id => ({ id }))) as unknown as typeof fetch;
    expect(resolveFreePool(REGISTRY)).toEqual(REGISTRY);
    expect(freePoolStatus().resolved).toBe(false);
  });

  it('drops a model the vendor no longer serves', async () => {
    const [first, ...rest] = REGISTRY;
    global.fetch = serveCatalogue([{ id: first }]) as unknown as typeof fetch;
    resolveFreePool(REGISTRY);
    await settle();

    const got = resolveFreePool(REGISTRY);
    expect(got).toContain(first);
    for (const gone of rest) expect(got).not.toContain(gone);
    expect(freePoolStatus().dropped).toEqual(expect.arrayContaining(rest));
  });

  it('appends live models the registry never knew about, AFTER the known ones', async () => {
    // Discovery adds fallbacks. It must never change what a healthy request
    // gets, because those ids carry no metadata and were never vetted.
    global.fetch = serveCatalogue([
      { id: 'aaa-would-sort-first:free' },
      ...REGISTRY.map(id => ({ id })),
    ]) as unknown as typeof fetch;
    resolveFreePool(REGISTRY);
    await settle();

    const got = resolveFreePool(REGISTRY);
    expect(got.slice(0, REGISTRY.length)).toEqual(REGISTRY);
    expect(got).toContain('aaa-would-sort-first:free');
    expect(got.indexOf('aaa-would-sort-first:free')).toBeGreaterThanOrEqual(REGISTRY.length);
  });

  it('never discovers a model that would be billed', async () => {
    global.fetch = serveCatalogue([
      ...REGISTRY.map(id => ({ id })),
      { id: 'costs-money', free: false },
    ]) as unknown as typeof fetch;
    resolveFreePool(REGISTRY);
    await settle();

    expect(resolveFreePool(REGISTRY)).not.toContain('costs-money');
  });

  it('never discovers a model that cannot use tools', async () => {
    // Cat drives a tool loop. A model that cannot emit a tool call is not a
    // fallback, it is a dead end that looks like an answer.
    global.fetch = serveCatalogue([
      ...REGISTRY.map(id => ({ id })),
      { id: 'classifier:free', tools: false },
    ]) as unknown as typeof fetch;
    resolveFreePool(REGISTRY);
    await settle();

    expect(resolveFreePool(REGISTRY)).not.toContain('classifier:free');
  });

  it('changes NOTHING when the catalogue cannot be read', async () => {
    // The failure that must stay harmless: a 401 from an expired key, a 500,
    // or a network error must not shrink the pool. Caching that answer would
    // also freeze the staleness in place for an hour.
    for (const outcome of [
      async () => ({ ok: false, status: 401, json: async () => ({}) }),
      async () => ({ ok: false, status: 500, json: async () => ({}) }),
      async () => {
        throw new Error('network down');
      },
    ]) {
      __resetFreePool();
      global.fetch = vi.fn(outcome) as unknown as typeof fetch;
      resolveFreePool(REGISTRY);
      await settle();

      expect(resolveFreePool(REGISTRY)).toEqual(REGISTRY);
      expect(freePoolStatus().resolved).toBe(false);
    }
  });

  it('falls back to the registry rather than returning an empty chain', async () => {
    // If the vendor lists none of our ids, a 404 we can retry past beats a
    // chain with nowhere to go.
    global.fetch = serveCatalogue([
      { id: 'something-entirely-different:free' },
    ]) as unknown as typeof fetch;
    resolveFreePool(REGISTRY);
    await settle();

    const got = resolveFreePool(REGISTRY);
    expect(got.length).toBeGreaterThan(0);
    expect(got).toEqual(expect.arrayContaining(REGISTRY));
  });

  it('resolves once, not once per message', async () => {
    // This sits on the hot path of every chat message.
    const fetchSpy = serveCatalogue(REGISTRY.map(id => ({ id })));
    global.fetch = fetchSpy as unknown as typeof fetch;

    resolveFreePool(REGISTRY);
    await settle();
    const afterFirst = fetchSpy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    for (let i = 0; i < 25; i++) resolveFreePool(REGISTRY);
    await settle();

    expect(fetchSpy.mock.calls.length).toBe(afterFirst);
  });

  it('does not resolve at all without a key', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const fetchSpy = serveCatalogue(REGISTRY.map(id => ({ id })));
    global.fetch = fetchSpy as unknown as typeof fetch;

    expect(resolveFreePool(REGISTRY)).toEqual(REGISTRY);
    await settle();
    expect(freePoolStatus().resolved).toBe(false);
  });
});
