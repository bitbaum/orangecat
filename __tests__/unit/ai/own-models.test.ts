/**
 * The models a person can choose for a bot (services/ai/own-models.ts).
 *
 * The list is the provider's own answer for the person's key; a chosen name
 * that is not a model id never reaches a provider; the shared pool has
 * nothing to choose and says so.
 */
import { chatModelsFrom, chosenModel, isModelId, listOwnModels } from '@/services/ai/own-models';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('a model id', () => {
  it('is a name as providers write them, and nothing else', () => {
    for (const ok of [
      'gpt-4o-mini',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      'grok-4:fast',
    ]) {
      expect(isModelId(ok), ok).toBe(true);
    }
    for (const bad of ['', 'two words', 'x'.repeat(121), '../etc', '-leading', 7, null]) {
      expect(isModelId(bad), String(bad)).toBe(false);
    }
  });

  it('is used for the turn only when it is one; "auto" and nothing mean the default', () => {
    expect(chosenModel('gpt-4o', 'gpt-4o-mini')).toBe('gpt-4o');
    expect(chosenModel('auto', 'gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(chosenModel(undefined, 'gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(chosenModel('not a model', 'gpt-4o-mini')).toBe('gpt-4o-mini');
  });
});

describe("a provider's list", () => {
  it('keeps chat models, once each, by name', () => {
    const models = chatModelsFrom({
      data: [
        { id: 'gpt-4o' },
        { id: 'text-embedding-3-small' },
        { id: 'whisper-1' },
        { id: 'gpt-4o' },
        { id: 'claude-x', display_name: 'Claude X' },
        { id: 'bad id' },
        { id: 'dall-e-3' },
      ],
    });
    expect(models).toEqual([
      { id: 'claude-x', name: 'Claude X' },
      { id: 'gpt-4o', name: 'gpt-4o' },
    ]);
    expect(chatModelsFrom(null)).toEqual([]);
    expect(chatModelsFrom({ data: 'x' })).toEqual([]);
  });
});

describe('listOwnModels', () => {
  it('has nothing to choose on the shared pool, and asks nobody', async () => {
    const fetchImpl = vi.fn();
    expect(await listOwnModels(null, fetchImpl as unknown as typeof fetch)).toEqual({
      source: 'pool',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks the person's own provider with their key, and always offers the default", async () => {
    let calledUrl = '';
    let auth = '';
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calledUrl = url;
      auth = String((init.headers as Record<string, string>).Authorization);
      return jsonResponse(200, { data: [{ id: 'grok-9' }, { id: 'grok-9-fast' }] });
    }) as unknown as typeof fetch;
    const res = await listOwnModels({ provider: 'xai', key: 'k-123' }, fetchImpl);
    expect(calledUrl).toBe('https://api.x.ai/v1/models');
    expect(auth).toBe('Bearer k-123');
    expect(res.source).toBe('own');
    if (res.source === 'own') {
      expect(res.provider).toBe('xai');
      expect(res.models[0].id).toBe(res.fallback);
      expect(res.models.map(m => m.id)).toEqual(expect.arrayContaining(['grok-9', 'grok-9-fast']));
    }
  });

  it('still offers the default when the provider does not answer', async () => {
    const fetchImpl = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    const res = await listOwnModels({ provider: 'openai', key: 'k' }, fetchImpl);
    expect(res).toEqual({
      source: 'own',
      provider: 'openai',
      fallback: 'gpt-4o-mini',
      models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini' }],
    });
  });

  it("lists this app's own table for an OpenRouter key, with no request", async () => {
    const fetchImpl = vi.fn();
    const res = await listOwnModels(
      { provider: 'openrouter', key: 'k' },
      fetchImpl as unknown as typeof fetch
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.source === 'own' && res.fallback).toBe('auto');
    expect(res.source === 'own' && res.models.length).toBeGreaterThan(0);
  });
});
