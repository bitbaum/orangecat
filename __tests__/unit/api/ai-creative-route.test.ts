/**
 * The Studio is a public page; a visitor's first draft used to end at a
 * sign-in wall in a new tab. A visitor drafts on the per-IP budgets, and one
 * unusable model answer is retried before the person is told to try again.
 */
const { session, limits, llm } = vi.hoisted(() => ({
  session: { user: null as { id: string } | null },
  limits: { write: vi.fn(), general: vi.fn(), studio: vi.fn() },
  llm: vi.fn(),
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
  rateLimitStudio: limits.studio,
  rateLimitDictation: vi.fn(),
  createRateLimitResponse: () => ({ status: 429 }),
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => ({ status: 200, data }),
  apiBadRequest: (error: string) => ({ status: 400, error }),
  apiError: (error: string, code: string, status: number) => ({ status, code, error }),
}));
vi.mock('@/services/cat/platform-llm', async () => {
  const real = await vi.importActual<typeof import('@/services/cat/platform-llm')>(
    '@/services/cat/platform-llm'
  );
  return { ...real, callPlatformJson: llm };
});

import { POST } from '@/app/api/ai/creative/route';
import { SITE_URL } from '@/config/brand';

type Reply = { status: number; data?: { title: string; text: string } };

function request(body: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return {
    headers: new Headers({ origin: new URL(SITE_URL).origin }),
    nextUrl: new URL(SITE_URL),
    body: new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
  };
}

const brief = { feeling: 'Rain on hot asphalt', form: 'poem' };

describe('POST /api/ai/creative', () => {
  beforeEach(() => {
    session.user = null;
    for (const l of Object.values(limits)) {
      l.mockReset().mockResolvedValue({ success: true });
    }
    llm.mockReset();
  });

  it('drafts for a visitor on the per-IP budgets', async () => {
    llm.mockResolvedValue(JSON.stringify({ title: 'Rain', text: 'Hot asphalt.', score: null }));
    const reply = (await POST(request(brief) as never)) as unknown as Reply;
    expect(reply.status).toBe(200);
    expect(reply.data?.title).toBe('Rain');
    expect(limits.general).toHaveBeenCalled();
    expect(limits.studio).toHaveBeenCalled();
    expect(limits.write).not.toHaveBeenCalled();
  });

  it('refuses a visitor whose budget is spent, before any model is called', async () => {
    limits.studio.mockResolvedValue({ success: false });
    const reply = (await POST(request(brief) as never)) as unknown as Reply;
    expect(reply.status).toBe(429);
    expect(llm).not.toHaveBeenCalled();
  });

  it('uses a signed-in person’s own budget', async () => {
    session.user = { id: 'u1' };
    llm.mockResolvedValue(JSON.stringify({ title: 'Rain', text: 'Hot asphalt.' }));
    await POST(request(brief) as never);
    expect(limits.write).toHaveBeenCalledWith('u1');
    expect(limits.studio).not.toHaveBeenCalled();
  });

  it('tries once more when the first answer is unusable', async () => {
    llm
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify({ title: 'Rain', text: 'Hot asphalt.' }));
    const reply = (await POST(request(brief) as never)) as unknown as Reply;
    expect(reply.status).toBe(200);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it('says to try again after two unusable answers', async () => {
    llm.mockResolvedValue(null);
    const reply = (await POST(request(brief) as never)) as unknown as Reply;
    expect(reply.status).toBe(503);
    expect(llm).toHaveBeenCalledTimes(2);
  });
});
