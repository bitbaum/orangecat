/**
 * A user's own direct key: its provider's models reach the picker, "auto"
 * sends the strongest of them, and a model the key lists is sent as picked.
 */
import {
  clearKeyModelsCache,
  isProbedProvider,
  MAX_MODELS_PER_KEY,
  modelForDirectKey,
  modelsForKey,
  peekModelsForKey,
  type KeyModels,
} from '@/services/cat/key-models';

const KEY = 'sk-not-a-real-key-1234';

type ProbeResult = {
  ok: boolean;
  status: number | null;
  message: string;
  models: string[];
  suggested: string | null;
};
const probeSaying = (result: ProbeResult) => vi.fn(async () => result);
const works = (models: string[], suggested: string | null) =>
  probeSaying({ ok: true, status: 200, message: 'Works.', models, suggested });

beforeEach(() => clearKeyModelsCache());

describe('modelsForKey', () => {
  it('lists what the provider says this key can use, strongest first', async () => {
    const probe = works(['claude-opus-5-5', 'claude-sonnet-5'], 'claude-opus-5-5');
    const km = await modelsForKey('anthropic', KEY, { probe });
    expect(km).toEqual({
      provider: 'anthropic',
      models: ['claude-opus-5-5', 'claude-sonnet-5'],
      suggested: 'claude-opus-5-5',
    });
  });

  it('asks once, then answers from the cache', async () => {
    const probe = works(['gpt-5'], 'gpt-5');
    await modelsForKey('openai', KEY, { probe, now: 0 });
    await modelsForKey('openai', KEY, { probe, now: 60_000 });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(peekModelsForKey('openai', KEY, 60_000)?.suggested).toBe('gpt-5');
  });

  it('a refused key yields nothing, and is not cached', async () => {
    const probe = probeSaying({
      ok: false,
      status: 401,
      message: 'no',
      models: [],
      suggested: null,
    });
    expect((await modelsForKey('groq', KEY, { probe })).models).toEqual([]);
    await modelsForKey('groq', KEY, { probe });
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('caps a long catalogue', async () => {
    const many = Array.from({ length: 40 }, (_, i) => `m-${i}`);
    const km = await modelsForKey('openai', KEY, { probe: works(many, 'm-0') });
    expect(km.models).toHaveLength(MAX_MODELS_PER_KEY);
  });

  it('never probes OpenRouter (it already unlocks the registry) or an unknown provider', async () => {
    const probe = works(['x'], 'x');
    expect(isProbedProvider('openrouter')).toBe(false);
    expect((await modelsForKey('openrouter', KEY, { probe })).models).toEqual([]);
    expect((await modelsForKey('not-a-vendor', KEY, { probe })).models).toEqual([]);
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('modelForDirectKey', () => {
  const groqKey: KeyModels = {
    provider: 'groq',
    models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    suggested: 'openai/gpt-oss-120b',
  };
  const groqRule = (m?: string) => (m?.startsWith('llama') ? m : 'groq-default');

  it('"auto" sends the strongest model the key can use', () => {
    expect(modelForDirectKey('auto', groqKey, groqRule)).toBe('openai/gpt-oss-120b');
    expect(modelForDirectKey(undefined, groqKey, groqRule)).toBe('openai/gpt-oss-120b');
  });

  it('a model the key lists is sent as picked, not swapped for a default', () => {
    expect(modelForDirectKey('openai/gpt-oss-120b', groqKey, groqRule)).toBe('openai/gpt-oss-120b');
  });

  it('falls back to the provider rule when the key has not been read', () => {
    expect(modelForDirectKey('auto', null, groqRule)).toBe('groq-default');
    expect(modelForDirectKey('something-else', groqKey, groqRule)).toBe('groq-default');
  });
});
