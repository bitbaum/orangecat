/**
 * Pins the provider wire contracts for BYOK image generation — the shapes we
 * cannot exercise against live keys from CI: the OpenAI-style
 * /images/generations response (b64_json + the gpt-image response_format
 * quirk) and OpenRouter's chat-modalities data-URI response.
 */

import { IMAGE_PROVIDER_RUNTIME, getImageProviderRuntime } from '@/config/ai-provider-runtime';
import { generateImageWithKey } from '@/services/images/generate';

// jsdom's AbortSignal may lack the static timeout() helper Node provides.
if (typeof AbortSignal.timeout !== 'function') {
  (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout = () =>
    new AbortController().signal;
}

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('IMAGE_PROVIDER_RUNTIME', () => {
  it('every declared provider resolves to a base URL and model', () => {
    for (const providerId of Object.keys(IMAGE_PROVIDER_RUNTIME)) {
      const runtime = getImageProviderRuntime(providerId);
      expect(runtime).not.toBeNull();
      expect(runtime!.baseUrl).toMatch(/^https:\/\//);
      expect(runtime!.defaultImageModel.length).toBeGreaterThan(0);
      expect(['images', 'chat']).toContain(runtime!.api);
    }
  });

  it('openrouter carries its own base URL (not in PROVIDER_RUNTIME)', () => {
    expect(getImageProviderRuntime('openrouter')?.baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('returns null for non-image providers', () => {
    expect(getImageProviderRuntime('groq')).toBeNull();
    expect(getImageProviderRuntime('deepseek')).toBeNull();
  });
});

describe('generateImageWithKey — images endpoint', () => {
  afterEach(() => vi.restoreAllMocks());

  it('decodes b64_json and sniffs PNG, omitting response_format for gpt-image models', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ data: [{ b64_json: PNG_BYTES.toString('base64') }] }));

    const result = await generateImageWithKey({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      prompt: 'a cat',
      api: 'images',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.mimeType).toBe('image/png');
      expect(Buffer.from(result.image.bytes)).toEqual(PNG_BYTES);
    }
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toBeUndefined();
  });

  it('requests b64_json for non-gpt-image models and sniffs JPEG', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ data: [{ b64_json: JPEG_BYTES.toString('base64') }] }));

    const result = await generateImageWithKey({
      apiKey: 'xai-test',
      baseUrl: 'https://api.x.ai/v1',
      model: 'grok-2-image',
      prompt: 'a cat',
      api: 'images',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.mimeType).toBe('image/jpeg');
    }
    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.response_format).toBe('b64_json');
  });

  it('surfaces the provider error message on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ error: { message: 'billing hard limit reached' } }, 400)
    );

    const result = await generateImageWithKey({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      prompt: 'a cat',
      api: 'images',
    });

    expect(result).toEqual({ ok: false, error: 'billing hard limit reached' });
  });
});

describe('generateImageWithKey — chat modalities (OpenRouter)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for image modality and decodes the data-URI response', async () => {
    const dataUri = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { images: [{ image_url: { url: dataUri } }] } }] })
      );

    const result = await generateImageWithKey({
      apiKey: 'sk-or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-3.1-flash-image',
      prompt: 'a cat',
      api: 'chat',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.mimeType).toBe('image/png');
      expect(Buffer.from(result.image.bytes)).toEqual(PNG_BYTES);
    }
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(init.body as string);
    expect(body.modalities).toEqual(['image', 'text']);
    expect(body.messages).toEqual([{ role: 'user', content: 'a cat' }]);
  });

  it('errors when the model answers with text only', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'I cannot' } }] })
    );

    const result = await generateImageWithKey({
      apiKey: 'sk-or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'google/gemini-3.1-flash-image',
      prompt: 'a cat',
      api: 'chat',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('no image');
    }
  });
});
