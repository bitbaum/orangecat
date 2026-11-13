/**
 * Dictation goes through @bitbaum/ai-kit's transcriber, over a chain.
 *
 * The route was one hand-rolled fetch at one Groq model: a rotted or briefly
 * overloaded model meant dictation was broken. These pin what the chain buys
 * (a second model answers when the first does not) and that the person is told
 * "busy" for a rate limit and "try again" for anything else.
 */
import { POST } from '@/app/api/cat/transcribe/route';
import { speechChain, speechConfigured } from '@bitbaum/ai-kit';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { session, limits } = vi.hoisted(() => ({
  session: { user: { id: 'test-user' } as { id: string } | null },
  limits: {
    write: vi.fn(),
    general: vi.fn(),
    dictation: vi.fn(),
  },
}));

vi.mock('@/lib/api/withAuth', () => ({
  withOptionalAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: session.user, supabase: {} })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: limits.write,
  rateLimit: limits.general,
  rateLimitDictation: limits.dictation,
  createRateLimitResponse: () => ({ status: 429 }),
  applyRateLimitHeaders: (response: unknown) => response,
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => ({ status: 200, data }),
  apiBadRequest: (error: string) => ({ status: 400, error }),
  apiError: (error: string, code: string, status: number) => ({ status, code, error }),
  apiInternalError: (error: string) => ({ status: 500, error }),
}));

type Reply = { status: number; data?: { text: string }; code?: string };

function request(bytes = 2048): unknown {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'audio/webm' }), 'audio.webm');
  return {
    formData: async () => form,
    signal: new AbortController().signal,
    headers: new Headers(),
  };
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
    session.user = { id: 'test-user' };
    limits.write.mockResolvedValue({ success: true });
    limits.general.mockResolvedValue({ success: true });
    limits.dictation.mockResolvedValue({ success: true });
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

  it.each(['Thank you.', 'Untertitelung des ZDF, 2020'])(
    "returns nothing for a silent take, not Whisper's filler (%s)",
    async filler => {
      global.fetch = vi.fn(async () => vendor(200, { text: filler })) as never;
      const reply = (await POST(request() as never)) as unknown as Reply;
      expect(reply.status).toBe(200);
      expect(reply.data?.text).toBe('');
    }
  );

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

  describe('a visitor with no account', () => {
    beforeEach(() => {
      session.user = null;
      global.fetch = vi.fn(async () => vendor(200, { text: 'A second oven.' })) as never;
    });

    it('is transcribed, on the per-IP budgets rather than a person’s', async () => {
      const reply = (await POST(request() as never)) as unknown as Reply;
      expect(reply.status).toBe(200);
      expect(reply.data?.text).toBe('A second oven.');
      expect(limits.general).toHaveBeenCalled();
      expect(limits.dictation).toHaveBeenCalled();
      expect(limits.write).not.toHaveBeenCalled();
    });

    it('is refused once the dictation budget is spent, before any model is called', async () => {
      limits.dictation.mockResolvedValue({ success: false });
      const reply = (await POST(request() as never)) as unknown as Reply;
      expect(reply.status).toBe(429);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('gets a shorter recording than a signed-in person', async () => {
      const reply = (await POST(request(3 * 1024 * 1024) as never)) as unknown as Reply;
      expect(reply.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();

      session.user = { id: 'test-user' };
      const signedIn = (await POST(request(3 * 1024 * 1024) as never)) as unknown as Reply;
      expect(signedIn.status).toBe(200);
    });
  });
});
