/**
 * A bot asks Loki as the person — what comes back is Loki's own sentence.
 *
 * The rail is read-only on both sides, so the only things this side can get
 * wrong are: asking when the rail is dark, inventing an answer Loki did not
 * give, or swallowing the sentence Loki wrote for the person (no linked
 * account, a spent budget). Each is pinned here.
 */
import { lokiAskHandlers } from '@/services/cat/handlers/loki-ask';
import { LOKI_ASK_MAX_LENGTH, askLokiAsPerson } from '@/services/loki/ask';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const SECRET = 'x'.repeat(48);
const ACTOR = '00000000-0000-4000-8000-000000000000';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.ORANGECAT_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe('askLokiAsPerson', () => {
  it('asks nothing when the rail is not configured', async () => {
    delete process.env.ORANGECAT_WEBHOOK_SECRET;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await askLokiAsPerson({ actorId: ACTOR, question: 'What is live?' });
    expect(out.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses locally an empty or oversize question', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await askLokiAsPerson({ actorId: ACTOR, question: '  ' })).ok).toBe(false);
    expect(
      (await askLokiAsPerson({ actorId: ACTOR, question: 'x'.repeat(LOKI_ASK_MAX_LENGTH + 1) })).ok
    ).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the actor, the trimmed question and the thread, and returns the answer', async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, { text: '  Two sites are live: shop and blog.  ' });
    });
    const out = await askLokiAsPerson({
      actorId: ACTOR,
      question: '  what is live?  ',
      threadId: 'thread-1',
    });
    expect(sent).toEqual({ actorId: ACTOR, question: 'what is live?', threadId: 'thread-1' });
    expect(out).toEqual({ ok: true, text: 'Two sites are live: shop and blog.' });
  });

  it("relays Loki's own sentence when it refuses", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        error: 'no linked Loki account',
        detail: 'This OrangeCat identity is not linked to a Loki account yet.',
      })
    );
    const out = await askLokiAsPerson({ actorId: ACTOR, question: 'x' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain('not linked to a Loki account');
  });

  it('does not invent an answer from an unreadable 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 200 }));
    const out = await askLokiAsPerson({ actorId: ACTOR, question: 'x' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain('could not be read');
  });
});

describe('ask_loki handler', () => {
  const supabase = {} as AnySupabaseClient;

  it("shows Loki's answer as the outcome", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { text: 'Nothing is queued.' })
    );
    const out = await lokiAskHandlers.ask_loki!(supabase, 'user', ACTOR, {
      question: 'Anything queued?',
    });
    expect(out).toEqual({
      success: true,
      data: { text: 'Nothing is queued.', displayMessage: 'Nothing is queued.' },
    });
  });

  it('fails with the reason when Loki does not answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(429, { error: 'Budget spent for today.' })
    );
    const out = await lokiAskHandlers.ask_loki!(supabase, 'user', ACTOR, { question: 'x' });
    expect(out.success).toBe(false);
    expect(out.error).toContain('Budget spent for today.');
  });
});
