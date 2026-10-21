import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) },
}));
const model = vi.hoisted(() => vi.fn());
const rate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: unknown) => handler }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: rate,
  createRateLimitResponse: () => new Response('{}', { status: 429 }),
}));
vi.mock('@/services/cat/platform-llm', () => ({
  callPlatformJson: model,
  parseJsonLoose: (s: string | null) => {
    try {
      return JSON.parse(s || 'null');
    } catch {
      return null;
    }
  },
}));
import { POST } from '@/app/api/ai/creative/route';
import { MORNING_SKETCH } from '@/domain/creative/music';
function request(body: unknown, origin = 'https://orangecat.ch') {
  return Object.assign(
    new Request('https://orangecat.ch/api/ai/creative', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { nextUrl: new URL('https://orangecat.ch/api/ai/creative'), user: { id: 'artist' } }
  );
}
const run = (r: ReturnType<typeof request>) => POST(r as never, {});
beforeEach(() => {
  vi.clearAllMocks();
  rate.mockResolvedValue({ success: true });
});
describe('creative generation boundaries', () => {
  it('rejects cross-origin requests before using a provider', async () => {
    expect((await run(request({}, 'https://elsewhere.test'))).status).toBe(403);
    expect(model).not.toHaveBeenCalled();
  });
  it('respects the write limit before generating', async () => {
    rate.mockResolvedValue({ success: false });
    expect((await run(request({ feeling: 'spring', form: 'music' }))).status).toBe(429);
    expect(model).not.toHaveBeenCalled();
  });
  it('bounds streamed request bytes and validates the medium', async () => {
    expect((await run(request({ feeling: 'x'.repeat(66000) }))).status).toBe(413);
    expect((await run(request({ feeling: 'spring', form: 'execute' }))).status).toBe(400);
    expect(model).not.toHaveBeenCalled();
  });
  it('cannot present prose as a playable music result', async () => {
    model.mockResolvedValue(JSON.stringify({ title: 'Spring', text: 'A melody' }));
    expect((await run(request({ feeling: 'spring', form: 'music' }))).status).toBe(503);
  });
  it('returns a validated playable score and retains the creative brief and revision', async () => {
    model.mockResolvedValue(
      JSON.stringify({ title: 'Spring', text: 'A hesitant melody', score: MORNING_SKETCH })
    );
    const response = await run(
      request({
        feeling: 'Walking to school, unrequited love',
        form: 'music',
        style: 'Ambient',
        previous: 'Old direction',
        previousScore: MORNING_SKETCH,
        revision: 'Leave it unresolved',
      })
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.score).toEqual(MORNING_SKETCH);
    const sent = JSON.parse(model.mock.calls[0][1]);
    expect(sent.feeling).toContain('unrequited');
    expect(sent.revision).toBe('Leave it unresolved');
    expect(sent.previousScore).toEqual(MORNING_SKETCH);
  });
  it('never attaches accidental audio to a poem', async () => {
    model.mockResolvedValue(
      JSON.stringify({
        title: 'Spring',
        text: 'The road / keeps your footsteps',
        score: MORNING_SKETCH,
      })
    );
    const response = await run(request({ feeling: 'spring', form: 'poem' }));
    expect((await response.json()).data.score).toBeUndefined();
  });
});
