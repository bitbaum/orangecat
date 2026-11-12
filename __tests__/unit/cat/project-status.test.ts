/**
 * Every project in one read — what may be said about a live site.
 *
 * A site that was not asked is "not checked", never "up". A redirect is the
 * site answering; a server error or silence is "down". A private address is
 * never asked. Loki's facts are quoted, and an unlinked or unreadable Loki
 * is said in words, not shown as an empty list.
 */
import { lokiSessionsHandlers } from '@/services/cat/handlers/loki-sessions';
import * as actorStatus from '@/services/loki/actor-status';
import {
  probeLive,
  projectLine,
  projectStatusMessage,
  readProjectStatus,
  type ProjectStatusRow,
} from '@/services/loki/project-status';
import * as sessions from '@/services/loki/sessions';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const ACTOR = '00000000-0000-4000-8000-000000000000';

const project = (name: string, liveUrl: string | null) => ({
  id: name,
  name,
  lokiUrl: `https://loki.orangecat.ch/projects/${name}`,
  liveUrl,
  status: 'idle' as const,
  blockReason: null,
  queueDepth: 0,
  currentWork: null,
  recentOutcomes: [],
  feedback: { new: 0, open: 0 },
  orangecat: [],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('probeLive', () => {
  const publicUrl = async () => ({ ok: true as const });

  it('never asks an address that is not public', async () => {
    const fetchImpl = vi.fn();
    const out = await probeLive('http://169.254.169.254/latest', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      check: async () => ({ ok: false, reason: 'IP address is private or reserved' }),
    });
    expect(out).toEqual({ state: 'not_checked', reason: 'IP address is private or reserved' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('counts an answer below 500 as up, without following a redirect', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302 }));
    const out = await probeLive('https://orangecat.ch', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      check: publicUrl,
    });
    expect(out).toMatchObject({ state: 'up', status: 302 });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual', method: 'GET' });
  });

  it('counts a server error or silence as down, in words', async () => {
    const bad = await probeLive('https://x.example', {
      fetchImpl: (async () => new Response(null, { status: 502 })) as unknown as typeof fetch,
      check: publicUrl,
    });
    expect(bad).toEqual({ state: 'down', reason: 'it answered 502' });
    const silent = await probeLive('https://x.example', {
      fetchImpl: (async () => {
        throw Object.assign(new Error('t'), { name: 'TimeoutError' });
      }) as unknown as typeof fetch,
      check: publicUrl,
    });
    expect(silent).toEqual({ state: 'down', reason: 'no answer in 6 seconds' });
  });
});

describe('readProjectStatus', () => {
  it('says so when Loki cannot be read or is not linked', async () => {
    vi.spyOn(sessions, 'readLokiSessions').mockResolvedValue({ ok: false, reason: 'x' });
    vi.spyOn(actorStatus, 'fetchLokiActorStatus').mockResolvedValueOnce(null);
    const unknown = await readProjectStatus(ACTOR);
    expect(unknown.ok).toBe(false);
    vi.spyOn(actorStatus, 'fetchLokiActorStatus').mockResolvedValueOnce({
      linked: false,
      projects: [],
      modelKeys: [],
    });
    const unlinked = await readProjectStatus(ACTOR);
    expect(!unlinked.ok && unlinked.reason).toContain('not linked to a Loki account');
  });

  it('joins status, session and the live answer per project, and names a wrong project', async () => {
    vi.spyOn(actorStatus, 'fetchLokiActorStatus').mockResolvedValue({
      linked: true,
      modelKeys: [],
      projects: [project('orangecat', 'https://orangecat.ch'), project('draft', null)],
    });
    vi.spyOn(sessions, 'readLokiSessions').mockResolvedValue({
      ok: true,
      sessions: [
        {
          project: 'OrangeCat',
          builder: 'cloud',
          online: true,
          state: 'working',
          label: 'Working',
          reason: null,
          task: null,
          lastActivityAt: null,
          runId: 'r-1',
          track: null,
          prUrl: 'https://github.com/bitbaum/orangecat/pull/1',
          statusUrl: null,
        },
      ],
    });
    const probe = vi.fn(async () => ({ state: 'down' as const, reason: 'it answered 502' }));
    const out = await readProjectStatus(ACTOR, { probe });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(out.ok && out.projects.map(p => p.live.state)).toEqual(['down', 'not_deployed']);
    if (out.ok) {
      expect(out.projects[0].session?.runId).toBe('r-1');
      const text = projectStatusMessage(out);
      expect(text.startsWith('1 live site is down.')).toBe(true);
      expect(text).toContain('live site https://orangecat.ch is DOWN: it answered 502');
      expect(text).toContain('latest run r-1: Working');
      expect(text).toContain('**draft**: idle · not deployed');
    }
    const wrong = await readProjectStatus(ACTOR, { project: 'nope', probe });
    expect(!wrong.ok && wrong.reason).toBe(
      'No project named "nope". Your projects: orangecat, draft.'
    );
  });
});

describe('what is said', () => {
  const row = (live: ProjectStatusRow['live']): ProjectStatusRow => ({
    ...project('site', 'https://site.example'),
    live,
    session: null,
  });

  it('never calls an unchecked site up', () => {
    const line = projectLine(row({ state: 'not_checked', reason: 'hostname does not resolve' }));
    expect(line).toContain('not checked: hostname does not resolve');
    expect(line).not.toMatch(/\bup\b|answered/);
    const text = projectStatusMessage({
      ok: true,
      projects: [row({ state: 'up', status: 200, ms: 120 })],
    });
    expect(text).toContain('Every live site that was checked answered.');
    expect(text).toContain('answered 200 in 120 ms');
  });
});

describe('the handler', () => {
  it('shows the refusal in words', async () => {
    vi.spyOn(actorStatus, 'fetchLokiActorStatus').mockResolvedValue(null);
    vi.spyOn(sessions, 'readLokiSessions').mockResolvedValue({ ok: false, reason: 'x' });
    const res = await lokiSessionsHandlers.project_status({} as AnySupabaseClient, 'u', ACTOR, {});
    expect(res.success).toBe(false);
    expect(res.error).toContain('could not be read');
  });
});
