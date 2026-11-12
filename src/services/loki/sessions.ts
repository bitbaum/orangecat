/**
 * Reading the person's Loki agent sessions over the signed rail.
 *
 * A bot that sends a task has to be able to read what came of it: which
 * sessions exist, what each is doing, where a run is on its way to live, and
 * what the agent actually said. Loki owns every one of those facts (its
 * canonical state, its run track, its transcript cache); this module carries
 * the request across as the person and turns the answer into lines a model
 * can repeat without inventing anything. A state is never derived here.
 *
 * Loki reads as the Loki user linked to the OrangeCat actor, so a bot can
 * only ever read its owner's own projects.
 */
import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';
import { logger } from '@/utils/logger';
import { postSignedToLoki } from './signed-post';

/** Loki's own ceiling on transcript items in one answer. */
export const LOKI_SESSIONS_MAX_ITEMS = 40;
const DEFAULT_ITEMS = 12;
/** The transcript read can wait a few seconds for the runner's snapshot. */
const TIMEOUT_MS = 20_000;

export interface LokiSession {
  project: string;
  builder: string | null;
  online: boolean;
  state: string;
  label: string;
  reason: string | null;
  task: string | null;
  lastActivityAt: string | null;
  runId: string | null;
  track: string | null;
  prUrl: string | null;
  statusUrl: string | null;
}

export interface LokiTranscriptItem {
  kind: string;
  at: string | null;
  text: string;
}

export interface LokiSessionsInput {
  /** OrangeCat actor the read is for; Loki maps it to the linked account. */
  actorId: string;
  /** One project: its row plus the tail of its conversation. */
  project?: string;
  /** One run, with its full track. */
  runId?: string;
  items?: number;
}

export type LokiSessionsOutcome =
  | {
      ok: true;
      sessions: LokiSession[];
      /** Present only when a project was named; null when Loki holds no conversation. */
      transcript?: { project: string; at: string | null; items: LokiTranscriptItem[] } | null;
    }
  | { ok: false; reason: string };

export function lokiSessionsUrl(): string {
  return (
    process.env.LOKI_SESSIONS_URL ||
    new URL(LOKI_ENDPOINTS.sessions, ECOSYSTEM.loki.siteUrl).toString()
  );
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const http = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

function safeJson(body: string | undefined): Record<string, unknown> | null {
  if (!body) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseSession(raw: unknown): LokiSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const project = str(r.project);
  const state = str(r.state);
  if (!project || !state) {
    return null;
  }
  return {
    project,
    builder: str(r.builder),
    online: r.online === true,
    state,
    label: str(r.label) ?? state,
    reason: str(r.reason),
    task: str(r.task),
    lastActivityAt: str(r.lastActivityAt),
    runId: str(r.runId),
    track: str(r.track),
    prUrl: http(r.prUrl),
    statusUrl: http(r.statusUrl),
  };
}

export async function readLokiSessions(input: LokiSessionsInput): Promise<LokiSessionsOutcome> {
  const project = input.project?.trim();
  const runId = input.runId?.trim();
  const items = Math.max(
    1,
    Math.min(LOKI_SESSIONS_MAX_ITEMS, Math.floor(input.items ?? DEFAULT_ITEMS) || DEFAULT_ITEMS)
  );

  const result = await postSignedToLoki(
    lokiSessionsUrl(),
    {
      actorId: input.actorId,
      // Loki refuses a request older than five minutes (no nonce on the rail).
      issuedAt: new Date().toISOString(),
      ...(runId ? { runId } : project ? { project, items } : {}),
    },
    { timeoutMs: TIMEOUT_MS }
  );

  if (!result.ok) {
    const parsed = safeJson(result.body);
    const detail = str(parsed?.detail);
    logger.warn('[loki-sessions] refused', { actorId: input.actorId, status: result.status });
    return { ok: false, reason: `Loki could not be read: ${detail ?? result.error}` };
  }

  const parsed = safeJson(result.body);
  if (!parsed || !Array.isArray(parsed.sessions)) {
    return {
      ok: false,
      reason: "Loki answered, but the answer could not be read. Say so, and don't invent one.",
    };
  }
  if (parsed.linked === false) {
    return {
      ok: false,
      reason:
        'This OrangeCat identity is not linked to a Loki account yet. Sign in to Loki with the same OrangeCat identity once, then try again.',
    };
  }

  const sessions = parsed.sessions.flatMap(s => parseSession(s) ?? []);
  if (!project || runId) {
    return { ok: true, sessions };
  }
  const t = parsed.transcript as Record<string, unknown> | null | undefined;
  const transcript =
    t && Array.isArray(t.items)
      ? {
          project: str(t.project) ?? project,
          at: str(t.at),
          items: t.items.flatMap((raw): LokiTranscriptItem[] => {
            const i = (raw ?? {}) as Record<string, unknown>;
            const text = str(i.text);
            return text ? [{ kind: str(i.kind) ?? 'note', at: str(i.at), text }] : [];
          }),
        }
      : null;
  return { ok: true, sessions, transcript };
}

/** One session as one line: what a person reads on Control. */
export function sessionLine(s: LokiSession): string {
  const parts = [`**${s.project}**: ${s.label}`];
  if (s.reason) {
    parts.push(s.reason);
  }
  if (s.task) {
    parts.push(`Task: ${s.task}`);
  }
  if (s.track) {
    parts.push(s.track);
  }
  if (s.runId) {
    parts.push(`Run ${s.runId}`);
  }
  if (s.prUrl) {
    parts.push(`PR ${s.prUrl}`);
  }
  if (s.builder) {
    parts.push(`${s.builder} builder ${s.online ? 'online' : 'offline'}`);
  }
  if (s.lastActivityAt) {
    parts.push(`last activity ${s.lastActivityAt}`);
  }
  return `- ${parts.join(' · ')}`;
}

const SPEAKER: Record<string, string> = { user: 'Asked', assistant: 'Agent', tool: 'Tool' };

/** The whole answer as text for the thread: rows, then the conversation quoted. */
export function sessionsMessage(outcome: Extract<LokiSessionsOutcome, { ok: true }>): string {
  if (outcome.sessions.length === 0) {
    return 'Loki has no projects for this account yet.';
  }
  const lines = outcome.sessions.map(sessionLine);
  if (outcome.transcript === undefined) {
    return lines.join('\n');
  }
  if (!outcome.transcript || outcome.transcript.items.length === 0) {
    return `${lines.join('\n')}\n\nLoki holds no conversation for this session right now (its builder may be offline, or no agent has run there yet).`;
  }
  const quoted = outcome.transcript.items
    .map(i => `> **${SPEAKER[i.kind] ?? 'Note'}:** ${i.text.replace(/\n/g, '\n> ')}`)
    .join('\n>\n');
  return `${lines.join('\n')}\n\nThe last ${outcome.transcript.items.length} lines of its conversation:\n\n${quoted}`;
}
