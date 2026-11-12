/**
 * A bot working on its own: the owner's switch per hand, the limits of the
 * loop, and the wait for an agent session's answer.
 *
 * What must hold: no row means "ask" (a tap), never more; "off" hides a
 * hand; "auto" never unlocks a high-risk hand the owner does not hold; the
 * loop stops by count and by time; and a followed run reports Loki's own
 * words, or says the time ran out, never an invented answer.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { COMPANION_COPY } from '@/config/companions';
import { canRunOnItsOwn, handMode, isHand, type HandMode } from '@/services/companions/hand-grants';
import { handRows } from '@/services/companions/hand-rows';
import {
  COMPANION_HANDS,
  handsActions,
  handsSection,
  ownSentence,
  stepResultMessage,
} from '@/services/companions/hands';
import { handsFor } from '@/services/companions/hands-server';
import {
  AUTO_STEP_BUDGET_MS,
  MAX_AUTO_STEPS,
  mayTakeStep,
  runAutoStep,
  runStillGoing,
  stepLine,
} from '@/services/companions/work-loop';
import { followLokiRun, runToFollow } from '@/services/loki/follow-run';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const grants = (entries: Array<[string, HandMode]>) => new Map(entries);

describe('a hand grant', () => {
  it('is "ask" unless the owner stored something else', () => {
    expect(handMode(null, 'ask_loki')).toBe('ask');
    expect(handMode(grants([]), 'ask_loki')).toBe('ask');
    expect(handMode(grants([['ask_loki', 'auto']]), 'ask_loki')).toBe('auto');
    expect(handMode(grants([['ask_loki', 'off']]), 'ask_loki')).toBe('off');
  });

  it('is only ever for a hand a bot can have', () => {
    expect(isHand('loki_sessions')).toBe(true);
    expect(isHand('send_payment')).toBe(false);
  });

  it('lets only the Loki hands run on their own: what publishes on OrangeCat always asks', () => {
    for (const id of [
      'ask_loki',
      'loki_sessions',
      'loki_run_status',
      'send_task_to_loki',
      'file_loki_finding',
      'loki_finding_status',
    ]) {
      expect(canRunOnItsOwn(id), id).toBe(true);
    }
    for (const id of COMPANION_HANDS.filter(h => h.startsWith('create_')).concat('send_to_loki')) {
      expect(canRunOnItsOwn(id), id).toBe(false);
    }
    expect(canRunOnItsOwn('send_payment')).toBe(false);
  });
});

describe('the rows the owner switches', () => {
  it('lists every hand once, in order, with words of its own', () => {
    const rows = handRows(grants([['loki_sessions', 'auto']]));
    expect(rows.map(r => r.id)).toEqual([...COMPANION_HANDS]);
    for (const row of rows) {
      expect(COMPANION_COPY.talk.abilities.labels[row.id], row.id).toBeTruthy();
    }
    expect(rows.find(r => r.id === 'loki_sessions')).toMatchObject({
      mode: 'auto',
      readOnly: true,
    });
    expect(rows.find(r => r.id === 'send_task_to_loki')).toMatchObject({
      acts: true,
      readOnly: false,
    });
  });

  it('marks what the owner cannot switch on yet', () => {
    const rows = handRows(grants([]), new Set(['ask_loki']));
    expect(rows.find(r => r.id === 'ask_loki')?.available).toBe(true);
    expect(rows.find(r => r.id === 'send_task_to_loki')?.available).toBe(false);
  });
});

/** A client answering `cat_permissions` and `companion_hand_grants` reads. */
function clientWith(tables: Record<string, unknown[]>) {
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
    return builder;
  });
  return { from } as unknown as AnySupabaseClient;
}

describe('handsFor one bot', () => {
  it('hides what is off, marks what is on its own, and leaves the rest asking', async () => {
    const client = clientWith({
      companion_hand_grants: [
        { action_id: 'create_event', mode: 'off' },
        { action_id: 'create_project', mode: 'auto' },
        { action_id: 'loki_sessions', mode: 'auto' },
        { action_id: 'send_payment', mode: 'auto' },
      ],
    });
    const hands = await handsFor(client, 'user-1', 'bot-1');
    const byId = new Map(hands.allowed.map(a => [a.action.id, a]));
    expect(byId.has('create_event')).toBe(false);
    expect(byId.get('loki_sessions')?.auto).toBe(true);
    expect(byId.get('ask_loki')?.auto).toBe(false);
    // Stored as auto, but it publishes: it stays offered and still asks.
    expect(byId.get('create_project')?.auto).toBe(false);
    expect(byId.has('send_payment')).toBe(false);
    expect(hands.section).toContain('run these yourself, with no tap: loki_sessions.');
  });

  it('never offers a high-risk hand the owner does not hold, whatever is stored', async () => {
    const client = clientWith({
      companion_hand_grants: [{ action_id: 'send_task_to_loki', mode: 'auto' }],
    });
    const hands = await handsFor(client, 'user-1', 'bot-1');
    expect(hands.allowed.some(a => a.action.id === 'send_task_to_loki')).toBe(false);
  });

  it('with no bot named, nothing is on its own', async () => {
    const hands = await handsFor(clientWith({}), 'user-1');
    expect(hands.allowed.every(a => !a.auto)).toBe(true);
    expect(hands.section).not.toContain('with no tap');
  });
});

describe('what the bot is told', () => {
  it('says which hands run at once, and that the result comes next', () => {
    const text = handsSection(handsActions(['ask_loki', 'loki_sessions']), ['loki_sessions'])!;
    expect(text).toContain(ownSentence(['loki_sessions']));
    expect(handsSection(handsActions(['ask_loki']))).not.toContain('with no tap');
  });

  it('hands a step result back with the instruction to carry on', () => {
    const msg = stepResultMessage('loki_sessions', '- **orangecat**: Working');
    expect(msg).toContain('[OrangeCat ran loki_sessions. Result:]\n- **orangecat**: Working');
    expect(msg).toContain('Carry on');
  });
});

describe('the loop ends', () => {
  it('by the number of steps and by the time of the turn', () => {
    expect(mayTakeStep(0, 0)).toBe(true);
    expect(mayTakeStep(MAX_AUTO_STEPS - 1, 1000)).toBe(true);
    expect(mayTakeStep(MAX_AUTO_STEPS, 1000)).toBe(false);
    expect(mayTakeStep(1, AUTO_STEP_BUDGET_MS)).toBe(false);
  });
});

describe('one step', () => {
  it('says what Loki said, or why it did not go through', () => {
    expect(stepLine({ success: true, data: { displayMessage: ' Sent. ' } })).toBe('Sent.');
    expect(stepLine({ success: true })).toBe('Done.');
    expect(stepLine({ success: false, error: 'Loki did not answer.' })).toBe(
      'Loki did not answer.'
    );
    expect(stepLine({ success: false })).toBe('That did not go through.');
  });

  it('never runs a hand that is not a Loki hand, and says so', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const client = { from: vi.fn(() => ({ insert })) } as unknown as AnySupabaseClient;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await runAutoStep(client, 'user-1', 'actor-1', 'conv-1', {
      action: 'create_project',
      parameters: { title: 'x' },
    });
    expect(out).toEqual({ ok: false, text: 'That one needs your tap; it was not run.' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('a step on its own', () => {
  /** A client with the owner's grants and a recording action log. */
  function stepClient(permissions: unknown[], usageToday = 0) {
    const logged: Array<Record<string, unknown>> = [];
    const from = vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit']) {
        builder[m] = vi.fn(() => builder);
      }
      builder.insert = vi.fn(async (row: Record<string, unknown>) => {
        logged.push({ table, ...row });
        return { error: null };
      });
      builder.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(
          table === 'cat_permissions'
            ? { data: permissions, error: null }
            : { data: null, error: null, count: usageToday }
        ).then(resolve);
      return builder;
    });
    return { client: { from } as unknown as AnySupabaseClient, logged };
  }
  const realEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...realEnv };
    vi.restoreAllMocks();
  });

  it('runs a hand switched on for the bot, and leaves a row in the action log', async () => {
    process.env.ORANGECAT_WEBHOOK_SECRET = 'x'.repeat(48);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, linked: true, sessions: [] }), { status: 200 })
    );
    const { client, logged } = stepClient([]);
    const out = await runAutoStep(client, 'user-1', 'actor-1', 'conv-1', {
      action: 'loki_sessions',
      parameters: {},
    });
    expect(out.ok).toBe(true);
    const log = logged.find(l => l.table === 'cat_action_log');
    expect(log).toMatchObject({
      user_id: 'user-1',
      action_id: 'loki_sessions',
      category: 'communication',
      status: 'completed',
      conversation_id: 'conv-1',
    });
  });

  it('never runs a high-risk hand the owner does not hold, and logs the refusal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { client, logged } = stepClient([]);
    const out = await runAutoStep(client, 'user-1', 'actor-1', 'conv-1', {
      action: 'send_task_to_loki',
      parameters: { task: 'x', projects: ['loki'] },
    });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('It needs your tap');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logged.find(l => l.table === 'cat_action_log')).toMatchObject({ status: 'failed' });
  });
});

describe('following a run', () => {
  const ACTOR = '00000000-0000-4000-8000-000000000000';
  const RUN = '11111111-1111-4111-8111-111111111111';
  const session = (state: string) => ({
    project: 'orangecat',
    builder: 'cloud',
    online: true,
    state,
    label: state === 'working' ? 'Working' : 'Done',
    runId: RUN,
  });
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  const realEnv = { ...process.env };
  beforeEach(() => {
    process.env.ORANGECAT_WEBHOOK_SECRET = 'x'.repeat(48);
  });
  afterEach(() => {
    process.env = { ...realEnv };
    vi.restoreAllMocks();
  });

  it('picks the first sent project that has a run', () => {
    expect(
      runToFollow([
        { project: 'loki', ok: false },
        { project: 'orangecat', ok: true, runId: RUN },
      ])
    ).toEqual({ project: 'orangecat', runId: RUN });
    expect(runToFollow([{ project: 'loki', ok: true }])).toBeNull();
    expect(runToFollow(undefined)).toBeNull();
  });

  it('waits until the run settles, then quotes the conversation', async () => {
    const states = ['working', 'working', 'done'];
    const bodies: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      bodies.push(body);
      if (!body.items) {
        return json({ ok: true, linked: true, sessions: [session(states.shift() ?? 'done')] });
      }
      return json({
        ok: true,
        linked: true,
        sessions: [
          {
            ...session('done'),
            handoff: { done: ['On main, last commit 4d40368'], checked: null, next: [] },
          },
        ],
        transcript: {
          project: 'orangecat',
          at: null,
          live: true,
          items: [{ kind: 'assistant', at: null, text: '## main...origin/main' }],
        },
      });
    });
    const sleep = vi.fn(async () => {});
    const out = await followLokiRun(
      ACTOR,
      { project: 'orangecat', runId: RUN },
      { sleep, intervalMs: 10 }
    );
    expect(sleep).toHaveBeenCalledTimes(2);
    // Every read is of THIS run: three polls, then its own session's tail.
    expect(bodies.every(b => b.runId === RUN && !('project' in b))).toBe(true);
    expect(bodies).toHaveLength(4);
    // The first poll asks Loki to watch the session for the whole wait.
    expect(bodies[0].watch).toBeGreaterThan(60);
    expect(bodies.slice(1).every(b => !('watch' in b))).toBe(true);
    expect(bodies[3].items).toBe(12);
    expect(out.text).toContain('The agent reported: On main, last commit 4d40368');
    expect(out.settled).toBe(true);
    expect(out.text).toContain(`Run ${RUN} on orangecat has settled.`);
    expect(out.text).toContain('> **Agent:** ## main...origin/main');
  });

  it('says the time ran out, and still reads what there is', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      return json({
        ok: true,
        linked: true,
        sessions: [session('working')],
        ...(body.items
          ? {
              transcript: {
                project: 'orangecat',
                at: '2026-11-12T05:00:00.000Z',
                live: false,
                items: [{ kind: 'assistant', at: null, text: 'old line' }],
              },
            }
          : {}),
      });
    });
    let t = 0;
    const out = await followLokiRun(
      ACTOR,
      { project: 'orangecat', runId: RUN },
      { sleep: async () => {}, now: () => (t += 40), waitMs: 100, intervalMs: 30 }
    );
    expect(out.settled).toBe(false);
    expect(out.text).toContain('is still going after the wait');
    expect(out.text).toContain('an older copy from 2026-11-12T05:00:00.000Z');
    expect(out.text).toContain('> **Agent:** old line');
    expect(out.text).not.toContain('The agent reported');
  });

  it('a run read back while it is still going is followed; a settled one is not', () => {
    expect(runStillGoing([{ ...session('working') } as never])).toEqual({
      project: 'orangecat',
      runId: RUN,
    });
    expect(runStillGoing([{ ...session('done') } as never])).toBeNull();
    expect(runStillGoing(undefined)).toBeNull();
  });
});
