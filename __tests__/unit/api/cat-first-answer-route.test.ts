/**
 * A visitor's first sentence gets one real Cat answer before any account.
 * It is a platform model call from a stranger, so it runs on the visitor
 * budgets (the general per-IP one, then its own) and only for the page's own
 * form.
 */
const { session, limits, llm } = vi.hoisted(() => ({
  session: { user: null as { id: string } | null },
  limits: { write: vi.fn(), general: vi.fn(), first: vi.fn() },
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
  rateLimitFirstAnswer: limits.first,
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

import { POST } from '@/app/api/cat/first-answer/route';
import { SITE_URL } from '@/config/brand';
import { CAT_DOOR } from '@/config/cat-door';
import { FIRST_ANSWER_SYSTEM, kindsForFirstAnswer } from '@/services/cat/first-answer';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

type Reply = { status: number; code?: string; data?: { answer: string } };

function request(body: unknown, origin = new URL(SITE_URL).origin) {
  return {
    headers: new Headers({ origin }),
    nextUrl: new URL(SITE_URL),
    json: async () => body,
  };
}

const sentence = 'I bake sourdough and want to sell it on Saturdays';

describe('POST /api/cat/first-answer', () => {
  beforeEach(() => {
    session.user = null;
    for (const l of Object.values(limits)) {
      l.mockReset().mockResolvedValue({ success: true });
    }
    llm.mockReset();
  });

  it('answers a visitor on the per-IP budgets, with their sentence in the prompt', async () => {
    llm.mockResolvedValue(JSON.stringify({ answer: 'That is a Product.' }));
    const reply = (await POST(request({ sentence }) as never)) as unknown as Reply;
    expect(reply.status).toBe(200);
    expect(reply.data?.answer).toBe('That is a Product.');
    expect(limits.general).toHaveBeenCalled();
    expect(limits.first).toHaveBeenCalled();
    expect(limits.write).not.toHaveBeenCalled();
    const [system, user] = llm.mock.calls[0];
    expect(system).toBe(FIRST_ANSWER_SYSTEM);
    expect(user).toContain(sentence);
  });

  it('refuses a visitor whose budget is spent, before any model is called', async () => {
    limits.first.mockResolvedValue({ success: false });
    const reply = (await POST(request({ sentence }) as never)) as unknown as Reply;
    expect(reply.status).toBe(429);
    expect(llm).not.toHaveBeenCalled();
  });

  it('refuses when the general per-IP budget is spent', async () => {
    limits.general.mockResolvedValue({ success: false });
    const reply = (await POST(request({ sentence }) as never)) as unknown as Reply;
    expect(reply.status).toBe(429);
    expect(limits.first).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
  });

  it('is for the page itself: another origin is refused before the budget is touched', async () => {
    const reply = (await POST(
      request({ sentence }, 'https://elsewhere.example') as never
    )) as unknown as Reply;
    expect(reply.status).toBe(403);
    expect(limits.general).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
  });

  it('rejects a sentence that is too short or too long', async () => {
    for (const bad of ['a', 'x'.repeat(CAT_DOOR.maxLength + 1), undefined]) {
      const reply = (await POST(request({ sentence: bad }) as never)) as unknown as Reply;
      expect(reply.status).toBe(400);
    }
    expect(llm).not.toHaveBeenCalled();
  });

  it('says so when no model answered, instead of inventing a reply', async () => {
    llm.mockResolvedValue(null);
    const reply = (await POST(request({ sentence }) as never)) as unknown as Reply;
    expect(reply.status).toBe(503);
    expect(reply.code).toBe('AI_UNAVAILABLE');
  });
});

describe('the first-answer prompt', () => {
  it('names every kind from the registry and forbids claiming anything was done', () => {
    const kinds = kindsForFirstAnswer();
    expect(kinds).toContain(`${ENTITY_REGISTRY.product.name}:`);
    expect(kinds).toContain(`${ENTITY_REGISTRY.project.name}:`);
    expect(FIRST_ANSWER_SYSTEM).toMatch(/NOT created/);
    expect(FIRST_ANSWER_SYSTEM).toMatch(/Never invent/);
  });
});
