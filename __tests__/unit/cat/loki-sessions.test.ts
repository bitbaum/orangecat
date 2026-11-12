/**
 * A bot reads the person's Loki sessions — what it may say about them.
 *
 * Loki owns the state, the track and the transcript; this side only carries
 * the read across as the person and quotes the answer. So what can go wrong
 * here is: reading when the rail is dark, forwarding a URL or a state Loki
 * did not send in the agreed shape, hiding Loki's own refusal sentence, or
 * presenting "no conversation" as an empty success.
 */
import { lokiSessionsHandlers } from '@/services/cat/handlers/loki-sessions';
import { readLokiSessions, sessionsMessage } from '@/services/loki/sessions';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const SECRET = 'x'.repeat(48);
const ACTOR = '00000000-0000-4000-8000-000000000000';
const RUN = '11111111-1111-4111-8111-111111111111';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const session = {
  project: 'orangecat',
  builder: 'cloud',
  online: true,
  state: 'working',
  label: 'Working',
  reason: null,
  task: 'git status --short --branch',
  lastActivityAt: '2026-11-12T03:05:00.000Z',
  runId: RUN,
  track: 'The agent is working on it.',
  prUrl: 'https://github.com/bitbaum/orangecat/pull/1',
  statusUrl: 'javascript:alert(1)',
};

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.ORANGECAT_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe('readLokiSessions', () => {
  it('reads nothing when the rail is not configured', async () => {
    delete process.env.ORANGECAT_WEBHOOK_SECRET;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await readLokiSessions({ actorId: ACTOR })).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the actor and a fresh issuedAt, and parses the rows', async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, { ok: true, linked: true, sessions: [session, { nope: 1 }] });
    });
    const out = await readLokiSessions({ actorId: ACTOR });
    expect(sent.actorId).toBe(ACTOR);
    expect(Math.abs(Date.now() - Date.parse(String(sent.issuedAt)))).toBeLessThan(60_000);
    expect('project' in sent || 'runId' in sent).toBe(false);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.sessions).toHaveLength(1);
      expect(out.sessions[0].runId).toBe(RUN);
      expect(out.sessions[0].statusUrl).toBeNull();
      expect(out.transcript).toBeUndefined();
    }
  });

  it('asks for one project with its transcript, capped at 40 items', async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, {
        ok: true,
        linked: true,
        sessions: [session],
        transcript: {
          project: 'orangecat',
          at: '2026-11-12T03:05:00.000Z',
          items: [
            { kind: 'user', at: null, text: 'git status --short --branch' },
            { kind: 'assistant', at: null, text: '## main...origin/main\nclean' },
            { kind: 'assistant', at: null, text: '  ' },
          ],
        },
      });
    });
    const out = await readLokiSessions({ actorId: ACTOR, project: ' orangecat ', items: 999 });
    expect(sent.project).toBe('orangecat');
    expect(sent.items).toBe(40);
    expect(out.ok && out.transcript?.items).toHaveLength(2);
    if (out.ok) {
      const text = sessionsMessage(out);
      expect(text).toContain('**orangecat**: Working');
      expect(text).toContain(`Run ${RUN}`);
      expect(text).toContain('> **Agent:** ## main...origin/main\n> clean');
    }
  });

  it("relays Loki's own sentence on a refusal, and names an unlinked account", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(404, { error: 'project not found', detail: 'No project named "lokey".' })
    );
    const refused = await readLokiSessions({ actorId: ACTOR, project: 'lokey' });
    expect(refused).toEqual({
      ok: false,
      reason: 'Loki could not be read: No project named "lokey".',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(200, { ok: true, linked: false, sessions: [] })
    );
    const unlinked = await readLokiSessions({ actorId: ACTOR });
    expect(unlinked.ok).toBe(false);
    if (!unlinked.ok) expect(unlinked.reason).toContain('not linked to a Loki account');
  });

  it('does not present an unreadable 2xx as an answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 200 }));
    expect((await readLokiSessions({ actorId: ACTOR })).ok).toBe(false);
  });
});

describe('sessionsMessage', () => {
  it('says so when Loki holds no conversation, instead of quoting nothing', () => {
    const text = sessionsMessage({ ok: true, sessions: [session as never], transcript: null });
    expect(text).toContain('holds no conversation');
  });

  it('says so when there are no projects', () => {
    expect(sessionsMessage({ ok: true, sessions: [] })).toContain('no projects');
  });
});

describe('the handlers', () => {
  it('loki_run_status refuses anything but a full runId before asking Loki', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await lokiSessionsHandlers.loki_run_status({} as AnySupabaseClient, 'u', ACTOR, {
      run_id: '70d1a78d',
    });
    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loki_run_status reads the one run and shows it as the thread line', async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, { ok: true, linked: true, sessions: [session] });
    });
    const res = await lokiSessionsHandlers.loki_run_status({} as AnySupabaseClient, 'u', ACTOR, {
      run_id: RUN,
    });
    expect(sent.runId).toBe(RUN);
    expect(res.success).toBe(true);
    expect((res.data as { displayMessage: string }).displayMessage).toContain(
      'PR https://github.com'
    );
  });

  it('loki_sessions reads every session, or one project with its conversation', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(String((init as RequestInit).body)));
      return jsonResponse(200, { ok: true, linked: true, sessions: [session], transcript: null });
    });
    const all = await lokiSessionsHandlers.loki_sessions({} as AnySupabaseClient, 'u', ACTOR, {});
    const one = await lokiSessionsHandlers.loki_sessions({} as AnySupabaseClient, 'u', ACTOR, {
      project: 'orangecat',
    });
    expect(all.success && one.success).toBe(true);
    expect('project' in bodies[0]).toBe(false);
    expect(bodies[1].project).toBe('orangecat');
    expect((one.data as { displayMessage: string }).displayMessage).toContain(
      'holds no conversation'
    );
  });
});
