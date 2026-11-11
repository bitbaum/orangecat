/**
 * Dictation goes through @bitbaum/ai-kit's transcriber, over a chain.
 *
 * The route was one hand-rolled fetch at one Groq model: a rotted or briefly
 * overloaded model meant dictation was broken. These pin what the chain buys
 * (a second model answers when the first does not) and that the person is told
 * "busy" for a rate limit and "try again" for anything else.
 */
import { POST } from '@/app/api/cat/transcribe/route';
import { speechChain, speechConfigured } from '@/services/ai/speech';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'test-user' }, supabase: {} })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  createRateLimitResponse: vi.fn(),
  applyRateLimitHeaders: (response: unknown) => response,
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => ({ status: 200, data }),
  apiBadRequest: (error: string) => ({ status: 400, error }),
  apiError: (error: string, code: string, status: number) => ({ status, code, error }),
  apiInternalError: (error: string) => ({ status: 500, error }),
}));

type Reply = { status: number; data?: { text: string }; code?: string };

function request(): unknown {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(2048)], { type: 'audio/webm' }), 'audio.webm');
  return { formData: async () => form, signal: new AbortController().signal };
}

function vendor(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/cat/transcribe', () => {
  const realFetch = global.fetch;
  const realKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-key';
  });
  afterEach(() => {
    global.fetch = realFetch;
    if (realKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = realKey;
    }
  });

  it('has two models to try, and knows when it has no key', () => {
    expect(speechChain().map(link => link.model)).toEqual([
      'whisper-large-v3-turbo',
      'whisper-large-v3',
    ]);
    expect(speechConfigured({})).toBe(false);
    expect(speechConfigured({ GROQ_API_KEY: 'k' })).toBe(true);
  });

  it('returns the transcript', async () => {
    global.fetch = vi.fn(async () => vendor(200, { text: ' Hello there. ' })) as never;
    const reply = (await POST(request() as never)) as unknown as Reply;
    expect(reply.status).toBe(200);
    expect(reply.data?.text).toBe('Hello there.');
  });

  it('falls to the second model when the first fails', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const model = String((init?.body as FormData).get('model'));
      calls.push(model);
      return model === 'whisper-large-v3-turbo'
        ? vendor(500, { error: { message: 'model overloaded' } })
        : vendor(200, { text: 'second model answered' });
    }) as never;
    const reply = (await POST(request() as never)) as unknown as Reply;
    expect(calls).toEqual(['whisper-large-v3-turbo', 'whisper-large-v3']);
    expect(reply.data?.text).toBe('second model answered');
  });

  it('says busy when the vendor is rate limiting', async () => {
    global.fetch = vi.fn(async () =>
      vendor(429, { error: { message: 'Rate limit reached' } })
    ) as never;
    const reply = (await POST(request() as never)) as unknown as Reply;
    expect(reply.status).toBe(429);
    expect(reply.code).toBe('AI_RATE_LIMITED');
  });

  it('says it is not configured without a key', async () => {
    delete process.env.GROQ_API_KEY;
    const reply = (await POST(request() as never)) as unknown as Reply;
    expect(reply.status).toBe(503);
    expect(reply.code).toBe('TRANSCRIBE_UNAVAILABLE');
  });
});
