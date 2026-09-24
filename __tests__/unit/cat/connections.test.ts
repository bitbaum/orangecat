/**
 * The connections registry and the Loki half of the two-way rail.
 *
 * The registry's one hard promise: a connection never claims a power Cat does
 * not have. The Loki reader's: it signs what it sends, caches per actor, and
 * tells "not linked" apart from "could not tell".
 */

import { createHmac } from 'crypto';
import { CAT_CONNECTIONS } from '@/config/cat-connections';
import { CAT_ACTIONS } from '@/config/cat-actions';
import {
  clearLokiActorStatusCache,
  fetchLokiActorStatus,
  parseActorStatus,
  type LokiProjectStatus,
} from '@/services/loki/actor-status';
import { renderLokiProjects } from '@/services/ai/context-sections';
import { detectOpeners } from '@/services/cat/prompt-suggestions';
import type { FullUserContext } from '@/services/ai/document-context';

const SECRET = 'x'.repeat(40);
const ACTOR = '11111111-1111-4111-8111-111111111111';

const project = (over: Partial<LokiProjectStatus> = {}): LokiProjectStatus => ({
  id: 'p1',
  name: 'Ceramics site',
  lokiUrl: 'https://loki.orangecat.ch/projects/p1',
  liveUrl: 'https://ceramics.example',
  status: 'idle',
  blockReason: null,
  queueDepth: 0,
  currentWork: null,
  recentOutcomes: ['success'],
  feedback: { new: 0, open: 0 },
  orangecat: [],
  ...over,
});

const okBody = (projects: unknown[]) => JSON.stringify({ ok: true, linked: true, projects });

function fakeFetch(status: number, body: string) {
  return vi.fn(
    async (_url: string, _init: RequestInit) =>
      new Response(body, { status, headers: { 'content-type': 'application/json' } })
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

beforeEach(() => clearLokiActorStatusCache());

describe('CAT_CONNECTIONS', () => {
  it('names only Cat actions that exist', () => {
    for (const c of CAT_CONNECTIONS) {
      for (const action of c.actions) {
        expect(CAT_ACTIONS[action], `${c.id} → ${action}`).toBeDefined();
      }
    }
  });

  it('has unique ids, a purpose and a way to connect', () => {
    expect(new Set(CAT_CONNECTIONS.map(c => c.id)).size).toBe(CAT_CONNECTIONS.length);
    for (const c of CAT_CONNECTIONS) {
      expect(c.purpose.trim()).not.toBe('');
      expect(c.connect.href).toBeTruthy();
    }
  });
});

describe('parseActorStatus', () => {
  it('reads a linked person’s projects', () => {
    const out = parseActorStatus(okBody([project()]));
    expect(out?.linked).toBe(true);
    expect(out?.projects[0].name).toBe('Ceramics site');
  });

  it('keeps "not linked" distinct from a failure', () => {
    expect(parseActorStatus(JSON.stringify({ ok: true, linked: false, projects: [] }))).toEqual({
      linked: false,
      projects: [],
    });
    expect(parseActorStatus('not json')).toBeNull();
    expect(parseActorStatus(JSON.stringify({ ok: false }))).toBeNull();
  });

  it('drops malformed projects and non-http URLs', () => {
    const out = parseActorStatus(
      okBody([
        { id: 'x' },
        project({ lokiUrl: 'javascript:alert(1)' }),
        { ...project({ id: 'p2' }), liveUrl: 'ftp://nope', status: 'weird' },
      ])
    );
    expect(out?.projects).toHaveLength(1);
    expect(out?.projects[0].liveUrl).toBeNull();
    expect(out?.projects[0].status).toBe('idle');
  });
});

describe('fetchLokiActorStatus', () => {
  it('signs exactly the bytes it sends, with a fresh issuedAt', async () => {
    const fetchImpl = fakeFetch(200, okBody([project()]));
    await fetchLokiActorStatus(ACTOR, { secret: SECRET, fetchImpl, now: () => 1_000_000 });
    const [, init] = fetchImpl.mock.calls[0];
    const body = init.body as string;
    expect(JSON.parse(body)).toEqual({
      actorId: ACTOR,
      issuedAt: new Date(1_000_000).toISOString(),
    });
    const expected = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
    expect((init.headers as Record<string, string>)['x-orangecat-signature']).toBe(expected);
  });

  it('caches per actor for a few minutes', async () => {
    const fetchImpl = fakeFetch(200, okBody([project()]));
    let t = 0;
    const opts = { secret: SECRET, fetchImpl, now: () => t };
    await fetchLokiActorStatus(ACTOR, opts);
    t = 60_000;
    await fetchLokiActorStatus(ACTOR, opts);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 10 * 60_000;
    await fetchLokiActorStatus(ACTOR, opts);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('is null — unknown — before Loki ships the endpoint, and when the rail is not armed', async () => {
    expect(
      await fetchLokiActorStatus(ACTOR, { secret: SECRET, fetchImpl: fakeFetch(404, '') })
    ).toBeNull();
    clearLokiActorStatusCache();
    const fetchImpl = fakeFetch(200, okBody([]));
    expect(await fetchLokiActorStatus(ACTOR, { secret: 'short', fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('renderLokiProjects', () => {
  it('says what changes the answer: live, blocked on them, feedback', () => {
    const out = renderLokiProjects([
      project({ status: 'blocked', blockReason: 'awaiting_user', feedback: { new: 2, open: 3 } }),
    ]);
    expect(out).toContain('live at https://ceramics.example');
    expect(out).toContain('waiting on the user');
    expect(out).toContain('2 new feedback');
  });

  it('renders nothing without projects', () => {
    expect(renderLokiProjects(null)).toBeNull();
    expect(renderLokiProjects([])).toBeNull();
  });
});

describe('Loki openers', () => {
  const ctx = (lokiProjects: LokiProjectStatus[]) =>
    ({
      profile: { name: 'Lena', bio: 'Ceramicist' },
      documents: [],
      entities: [],
      tasks: [],
      wallets: [],
      conversations: [],
      lokiProjects,
    }) as unknown as FullUserContext;

  it('leads with a build that is waiting on its owner', () => {
    const [top] = detectOpeners(
      ctx([project({ status: 'blocked', blockReason: 'awaiting_user' })])
    );
    expect(top.key).toMatch(/^loki-waiting:p1/);
    expect(top.say).toContain('Ceramics site');
  });

  it('brings up new visitor feedback, without promising a summary it cannot see', () => {
    const openers = detectOpeners(ctx([project({ feedback: { new: 3, open: 3 } })]));
    const o = openers.find(x => x.key.startsWith('loki-feedback:'));
    expect(o?.say).toContain('3 new pieces');
    expect(o?.replies.join(' ')).not.toMatch(/summar/i);
  });

  it('stays quiet about a project that needs nothing', () => {
    const openers = detectOpeners(ctx([project()]));
    expect(openers.some(o => o.key.startsWith('loki-'))).toBe(false);
  });
});
