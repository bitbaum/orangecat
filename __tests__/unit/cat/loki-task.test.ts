/**
 * Sending one task to several Loki projects — what the model is allowed to say.
 *
 * Loki answers when the task is DISPATCHED. Agents take minutes to hours
 * after that, so nothing here may report work as done, and a project that did
 * not get the task must be named rather than folded into a success.
 */
import { lokiTaskHandlers } from '@/services/cat/handlers/loki-task';
import { parseProjectList, sendTaskToLoki, summarise } from '@/services/loki/task-dispatch';
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

describe('parseProjectList', () => {
  it('accepts arrays and prose lists, deduped case-insensitively', () => {
    expect(parseProjectList(['OrangeCat', 'loki', 'orangecat'])).toEqual(['OrangeCat', 'loki']);
    expect(parseProjectList('orangecat and loki, solon')).toEqual(['orangecat', 'loki', 'solon']);
    expect(parseProjectList(undefined)).toEqual([]);
  });
});

describe('sendTaskToLoki', () => {
  it('sends nothing when the rail is not configured', async () => {
    delete process.env.ORANGECAT_WEBHOOK_SECRET;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await sendTaskToLoki({ actorId: ACTOR, task: 'x', projects: ['loki'] });
    expect(out.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses locally before Loki when no project is named', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await sendTaskToLoki({ actorId: ACTOR, task: 'x', projects: [] });
    expect(out.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("relays Loki's refusal and the names that would have worked", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, {
        ok: false,
        detail: 'No project named "lokey". Nothing was sent.',
        available: ['loki', 'orangecat'],
      })
    );
    const out = await sendTaskToLoki({ actorId: ACTOR, task: 'x', projects: ['lokey'] });
    expect(out).toMatchObject({ ok: false, available: ['loki', 'orangecat'] });
    if (!out.ok) expect(out.reason).toContain('Nothing was sent');
  });

  it('posts actor, task and projects, and reports SENT, never done', async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, {
        ok: true,
        results: [
          { project: 'orangecat', ok: true, mode: 'direct' },
          { project: 'loki', ok: true, mode: 'queued' },
        ],
      });
    });
    const out = await sendTaskToLoki({
      actorId: ACTOR,
      task: '  make prompts postable  ',
      projects: ['orangecat', 'loki'],
    });
    expect(sent).toEqual({
      actorId: ACTOR,
      task: 'make prompts postable',
      projects: ['orangecat', 'loki'],
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.summary).toContain('SENT to orangecat, loki');
      expect(out.summary).toContain('nothing has been changed yet');
      expect(out.summary).toContain('loki is queued');
    }
  });

  it('does not report an unreadable 2xx as sent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 200 }));
    const out = await sendTaskToLoki({ actorId: ACTOR, task: 'x', projects: ['loki'] });
    expect(out.ok).toBe(false);
  });
});

describe('summarise', () => {
  it('names every project that did not get the task', () => {
    const s = summarise([
      { project: 'orangecat', ok: true, mode: 'direct' },
      { project: 'loki', ok: false, message: 'Project not found: loki' },
    ]);
    expect(s).toContain('SENT to orangecat');
    expect(s).toContain('NOT sent to loki (Project not found: loki)');
  });
});

describe('the Cat handler', () => {
  it('fails the action when no project got the task', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { ok: true, results: [{ project: 'loki', ok: false, message: 'busy' }] })
    );
    const res = await lokiTaskHandlers.send_task_to_loki({} as AnySupabaseClient, 'user-1', ACTOR, {
      task: 'x',
      projects: ['loki'],
    });
    expect(res.success).toBe(false);
  });
});
