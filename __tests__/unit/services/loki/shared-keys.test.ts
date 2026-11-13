/**
 * A key the person keeps on Loki answers their bots here, and never comes here.
 */
import { createHmac } from 'node:crypto';

import { keysLokiCanAnswerOn } from '@/services/ai/keys-elsewhere';
import { LokiKeyError, lokiKeyService } from '@/services/ai/loki-key-service';
import { pickOwnKey, readOwnKey } from '@/services/ai/own-key';
import { listOwnModels } from '@/services/ai/own-models';
import {
  fetchLokiKeys,
  forgetLokiKeys,
  parseLokiKeys,
  shareLokiKey,
} from '@/services/loki/shared-keys';

const SECRET = 'shared-keys-test-secret-at-least-32-characters';
const ACTOR = '00000000-0000-4000-8000-000000000000';

interface Seen {
  url: string;
  body: string;
  signature: string | null;
}
function loki(status: number, answer: unknown) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: String(url),
      body: String(init?.body),
      signature: new Headers(init?.headers).get('x-orangecat-signature'),
    });
    return new Response(JSON.stringify(answer), { status });
  }) as typeof fetch;
  return { seen, opts: { fetchImpl, secret: SECRET } };
}

describe('keys held on Loki', () => {
  beforeEach(() => forgetLokiKeys(ACTOR));

  it('keeps only what type-checks from Loki', () => {
    expect(parseLokiKeys('nope')).toBeNull();
    expect(parseLokiKeys('{"keys":"x"}')).toBeNull();
    expect(
      parseLokiKeys(
        JSON.stringify({
          keys: [
            { vendor: 'xai', label: 'xAI', model: 'grok-4', keyHint: '…abcd', shared: true },
            { vendor: '', shared: true },
            { vendor: 'openai', shared: 'yes', apiKey: 'sk-should-never-be-read' },
          ],
        })
      )
    ).toEqual([
      { vendor: 'xai', label: 'xAI', model: 'grok-4', keyHint: '…abcd', shared: true },
      { vendor: 'openai', label: 'openai', model: null, keyHint: null, shared: false },
    ]);
  });

  it('asks as the actor, signed over the exact bytes sent', async () => {
    const { seen, opts } = loki(200, { ok: true, keys: [{ vendor: 'xai', shared: false }] });
    const keys = await fetchLokiKeys(ACTOR, opts);
    expect(keys).toHaveLength(1);
    const sent = JSON.parse(seen[0].body);
    expect(sent.actorId).toBe(ACTOR);
    expect(sent.request).toEqual({ do: 'keys' });
    expect(seen[0].signature).toBe(
      'sha256=' + createHmac('sha256', SECRET).update(seen[0].body).digest('hex')
    );
    await fetchLokiKeys(ACTOR, opts);
    expect(seen).toHaveLength(1);
  });

  it('a switch forgets the cached list and passes on Loki’s own sentence', async () => {
    const list = loki(200, { ok: true, keys: [{ vendor: 'xai', shared: false }] });
    await fetchLokiKeys(ACTOR, list.opts);
    const on = loki(200, { ok: true, vendor: 'xai', shared: true });
    expect(await shareLokiKey(ACTOR, 'xai', true, on.opts)).toEqual({ ok: true, shared: true });
    expect(JSON.parse(on.seen[0].body).request).toEqual({ do: 'share', vendor: 'xai', on: true });
    await fetchLokiKeys(ACTOR, list.opts);
    expect(list.seen).toHaveLength(2);

    const refused = loki(404, { error: 'no such key', detail: 'There is no key to share.' });
    expect(await shareLokiKey(ACTOR, 'groq', true, refused.opts)).toEqual({
      ok: false,
      message: 'There is no key to share.',
    });
  });

  it('offers a key only for a provider with no key here', () => {
    const held = [
      { vendor: 'xai', label: 'xAI', model: 'grok-4', keyHint: '…abcd', shared: false },
      { vendor: 'groq', label: 'Groq', model: null, keyHint: null, shared: true },
    ];
    const offered = keysLokiCanAnswerOn(held, ['groq']);
    expect(offered.map(k => k.provider)).toEqual(['xai']);
    expect(offered[0]).toMatchObject({ canShare: true, shared: false, keyHint: '…abcd' });
  });
});

describe('a bot turn on a key held on Loki', () => {
  const none = { listDecryptedKeysOrdered: async () => [] };
  const onLoki = async () => [{ provider: 'xai', key: '', lokiActorId: ACTOR, model: 'grok-4' }];

  it('a key saved here wins, and Loki is not asked', async () => {
    const asked = vi.fn(onLoki);
    const here = { listDecryptedKeysOrdered: async () => [{ provider: 'groq', key: 'gsk_x' }] };
    const own = await readOwnKey(here, 'u1', asked);
    expect(own.directKey).toEqual({ provider: 'groq', key: 'gsk_x' });
    expect(asked).not.toHaveBeenCalled();
  });

  it('with none here, a switched-on Loki key is the person’s own key', async () => {
    const own = await readOwnKey(none, 'u1', onLoki);
    expect(own.hasByok).toBe(true);
    expect(own.userKey).toBeNull();
    expect(own.directKey?.lokiActorId).toBe(ACTOR);
  });

  it('an OpenRouter key on Loki goes through Loki, never as a key here', async () => {
    const own = await readOwnKey(none, 'u1', async () => [
      { provider: 'openrouter', key: '', lokiActorId: ACTOR },
    ]);
    expect(own.userKey).toBeNull();
    expect(own.directKey?.provider).toBe('openrouter');
  });

  it('Loki not answering is no key, not an error', async () => {
    const own = await readOwnKey(none, 'u1', async () => {
      throw new Error('down');
    });
    expect(own).toEqual({ hasByok: false, userKey: null, directKey: null });
    expect(pickOwnKey([{ provider: 'xai', key: '' }])).toBeNull();
  });

  it('sends the turn to Loki and returns the words, with no key anywhere', async () => {
    const { seen, opts } = loki(200, {
      ok: true,
      done: true,
      model: 'grok-4-0709',
      content: 'Hello.',
      finishReason: 'stop',
      usage: { promptTokens: 7, completionTokens: 2, totalTokens: 9 },
    });
    const out = await lokiKeyService(ACTOR, 'xai', opts).chatCompletion({
      model: '',
      messages: [{ role: 'user', content: 'Say hello.' }],
      temperature: 0.7,
      maxTokens: 20_000,
    });
    expect(out).toMatchObject({
      content: 'Hello.',
      model: 'grok-4-0709',
      inputTokens: 7,
      outputTokens: 2,
      usedByok: true,
      isFreeModel: false,
      finishReason: 'stop',
    });
    const request = JSON.parse(seen[0].body).request;
    expect(request).toEqual({
      do: 'complete',
      vendor: 'xai',
      messages: [{ role: 'user', content: 'Say hello.' }],
      temperature: 0.7,
      maxTokens: 8192,
    });
    expect(seen[0].url).toMatch(/\/api\/orangecat\/model$/);
  });

  it('a provider refusal keeps its status, so a rate limit reads as one', async () => {
    const { opts } = loki(200, { ok: true, done: false, status: 429, detail: 'Too many requests' });
    await expect(
      lokiKeyService(ACTOR, 'xai', opts).chatCompletion({
        model: 'grok-4',
        messages: [],
        temperature: 0,
      })
    ).rejects.toMatchObject({ name: 'LokiKeyError', status: 429 });

    const off = loki(403, { error: 'key not shared', detail: 'That key is not switched on.' });
    const err = await lokiKeyService(ACTOR, 'xai', off.opts)
      .chatCompletion({ model: '', messages: [], temperature: 0 })
      .catch(e => e);
    expect(err).toBeInstanceOf(LokiKeyError);
    expect(err.message).toBe('That key is not switched on.');
  });

  it('the model list is Loki’s, with the one chosen there as the default', async () => {
    const choices = await listOwnModels(
      { provider: 'xai', key: '', lokiActorId: ACTOR, model: 'grok-4' },
      fetch,
      async () => ({ chosen: 'grok-4', models: ['grok-4', 'grok-3-mini', 'grok-imagine-image'] })
    );
    expect(choices).toMatchObject({
      source: 'own',
      provider: 'xai',
      fallback: 'grok-4',
      heldOn: 'loki',
    });
    expect(choices.source === 'own' && choices.models.map(m => m.id)).toEqual([
      'grok-3-mini',
      'grok-4',
    ]);
  });
});
