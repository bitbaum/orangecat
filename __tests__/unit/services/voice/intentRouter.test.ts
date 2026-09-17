/**
 * Routing one spoken sentence to the thing someone meant to create.
 *
 * The value of this router is entirely in when it declines. Landing a person in
 * the wrong create form is worse than asking them: they have to notice, back
 * out, and start over — and saving them that was the whole point of letting
 * them speak instead of choosing a form.
 */

import { routeVoiceIntent, MIN_ROUTE_CONFIDENCE } from '@/services/voice/intent-router';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

/** Shapes a model reply the way the provider returns it. */
/**
 * A real `Response`, built fresh per call.
 *
 * This was a `{ ok, json }` literal. It quietly encoded an assumption about HOW
 * the client reads a body, and broke the moment it read the text first — which
 * it must, to keep the vendor's body in the error and tell a spent daily budget
 * from a busy minute. And a factory rather than a value, because one Response
 * body can be read only once: a shared instance makes the second link fail with
 * "Body has already been read".
 */
function modelReplies(payload: unknown) {
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
  );
}

const SENTENCE = 'sell my old road bike for 200 francs, a Cannondale in decent condition';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GROQ_API_KEY = 'test-key';
});

describe('routeVoiceIntent', () => {
  it('routes a clear sentence to its entity type', async () => {
    modelReplies({
      entityType: 'product',
      description: 'Cannondale road bike, decent condition, CHF 200',
      confidence: 0.94,
    });

    const intent = await routeVoiceIntent(SENTENCE);

    expect(intent).toMatchObject({
      entityType: 'product',
      description: 'Cannondale road bike, decent condition, CHF 200',
    });
  });

  it('declines when the model is unsure rather than picking anyway', async () => {
    modelReplies({
      entityType: 'project',
      description: 'sort out my finances',
      confidence: MIN_ROUTE_CONFIDENCE - 0.01,
    });

    await expect(routeVoiceIntent('I need to sort my finances out')).resolves.toBeNull();
  });

  it('rejects an entity type that is not real', async () => {
    // A hallucinated type would route to a create path that does not exist.
    modelReplies({ entityType: 'spaceship', description: 'a spaceship', confidence: 0.99 });

    await expect(routeVoiceIntent(SENTENCE)).resolves.toBeNull();
  });

  it('rejects a type that exists but cannot be prefilled', async () => {
    // `group` is a real entity and deliberately excluded from prefill.
    modelReplies({ entityType: 'group', description: 'a group for cyclists', confidence: 0.95 });

    await expect(routeVoiceIntent('start a group for cyclists')).resolves.toBeNull();
  });

  it('keeps their words when the model returns a type but no description', async () => {
    modelReplies({ entityType: 'product', confidence: 0.9 });

    const intent = await routeVoiceIntent(SENTENCE);

    expect(intent?.description).toBe(SENTENCE);
  });

  it('declines on unparseable output, a failed call, or no key — never throws', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
    });
    await expect(routeVoiceIntent(SENTENCE)).resolves.toBeNull();

    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(routeVoiceIntent(SENTENCE)).resolves.toBeNull();

    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(routeVoiceIntent(SENTENCE)).resolves.toBeNull();

    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    await expect(routeVoiceIntent(SENTENCE)).resolves.toBeNull();
  });

  it('does not call the model for a transcript too short to carry an intent', async () => {
    await expect(routeVoiceIntent('hi')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies near-deterministically, so the same words land in the same form', async () => {
    modelReplies({ entityType: 'product', description: 'a bike', confidence: 0.9 });
    await routeVoiceIntent(SENTENCE);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.temperature).toBeLessThanOrEqual(0.2);
    // This used to assert response_format: json_object on every call. Groq's
    // gpt-oss-120b — the leader here — answers 400 json_validate_failed for
    // EVERY request carrying that flag, so pinning it pinned an outage. JSON
    // mode is now sent only to models that accept it; the prompt demands
    // JSON-only output and parseJsonLoose reads the rest.
    expect(body.response_format).toBeUndefined();
  });
});
