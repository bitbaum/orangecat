/**
 * Every project of a person, in one read: what Loki says it is doing, where
 * its last run is, and whether its live site answers right now.
 *
 * Three sources, each the owner of its own fact. Loki's actor status says
 * what each project is doing and what waits in its inbox; Loki's sessions
 * say where the latest run is and name its pull request; the live site says
 * for itself whether it is up, by answering a request made here. Nothing is
 * inferred: a site that was not asked is "not checked", never "up".
 */
import { PinnedGetRefused, pinnedGetStatus } from '@/lib/security/pinned-get';
import { fetchLokiActorStatus, type LokiProjectStatus } from './actor-status';
import { readLokiSessions, type LokiSession } from './sessions';

const PROBE_TIMEOUT_MS = 6_000;
/** Sites asked in one read. More than this and the read outlasts a turn. */
const MAX_PROBES = 25;

export type LiveCheck =
  | { state: 'up'; status: number; ms: number }
  | { state: 'down'; reason: string }
  | { state: 'not_deployed' }
  | { state: 'not_checked'; reason: string };

export interface ProjectStatusRow {
  name: string;
  status: LokiProjectStatus['status'];
  blockReason: string | null;
  currentWork: string | null;
  queueDepth: number;
  feedback: { new: number; open: number };
  lokiUrl: string;
  liveUrl: string | null;
  live: LiveCheck;
  session: LokiSession | null;
}

export type ProjectStatusOutcome =
  { ok: true; projects: ProjectStatusRow[] } | { ok: false; reason: string };

/** Why a probe was not made, in words, from the refusal the pinned GET raised. */
function refusedReason(err: unknown): string | null {
  if (err instanceof PinnedGetRefused) {
    return err.message;
  }
  const code = (err as { code?: string } | null)?.code;
  return code === 'EPRIVATEADDR' ? 'it resolves to a private or reserved address' : null;
}

/**
 * Ask one live site whether it answers. The request can only reach a public
 * address on the default port (lib/security/pinned-get.ts), never follows a
 * redirect and never reads the body. A name that does not resolve is the
 * site being down; an address it may not ask is "not checked".
 */
export async function probeLive(
  url: string,
  opts: { send?: (url: string, timeoutMs: number) => Promise<number>; now?: () => number } = {}
): Promise<LiveCheck> {
  const now = opts.now ?? (() => Date.now());
  const started = now();
  try {
    const status = await (opts.send ?? pinnedGetStatus)(url, PROBE_TIMEOUT_MS);
    const ms = Math.round(now() - started);
    // A redirect is the site answering; only a server error is "down".
    return status > 0 && status < 500
      ? { state: 'up', status, ms }
      : { state: 'down', reason: `it answered ${status}` };
  } catch (err) {
    const refused = refusedReason(err);
    if (refused) {
      return { state: 'not_checked', reason: refused };
    }
    const e = err as { name?: string; code?: string } | null;
    return {
      state: 'down',
      reason:
        e?.name === 'TimeoutError'
          ? `no answer in ${PROBE_TIMEOUT_MS / 1000} seconds`
          : e?.code === 'ENOTFOUND' || e?.code === 'EAI_AGAIN'
            ? 'its name does not resolve'
            : 'it could not be reached',
    };
  }
}

export async function readProjectStatus(
  actorId: string,
  opts: { project?: string; probe?: (url: string) => Promise<LiveCheck> } = {}
): Promise<ProjectStatusOutcome> {
  const [status, sessions] = await Promise.all([
    // Read now, not the Cat's five-minute copy: this is asked for the current state.
    fetchLokiActorStatus(actorId, { fresh: true }),
    readLokiSessions({ actorId }),
  ]);
  if (!status) {
    return {
      ok: false,
      reason: 'Loki could not be read just now, so the state of the projects is unknown.',
    };
  }
  if (!status.linked) {
    return {
      ok: false,
      reason:
        'This OrangeCat identity is not linked to a Loki account yet. Sign in to Loki with the same OrangeCat identity once, then try again.',
    };
  }
  const wanted = opts.project?.trim().toLowerCase();
  const projects = wanted
    ? status.projects.filter(p => p.name.toLowerCase() === wanted)
    : status.projects;
  if (wanted && projects.length === 0) {
    const names = status.projects.map(p => p.name).join(', ') || 'none yet';
    return { ok: false, reason: `No project named "${opts.project}". Your projects: ${names}.` };
  }
  const byName = new Map<string, LokiSession>();
  if (sessions.ok) {
    for (const s of sessions.sessions) {
      byName.set(s.project.toLowerCase(), s);
    }
  }
  const probe = opts.probe ?? (url => probeLive(url));
  const rows = await Promise.all(
    projects.map(async (p, i): Promise<ProjectStatusRow> => {
      const live: LiveCheck = !p.liveUrl
        ? { state: 'not_deployed' }
        : i >= MAX_PROBES
          ? { state: 'not_checked', reason: 'too many sites for one read' }
          : await probe(p.liveUrl);
      return {
        name: p.name,
        status: p.status,
        blockReason: p.blockReason,
        currentWork: p.currentWork,
        queueDepth: p.queueDepth,
        feedback: p.feedback,
        lokiUrl: p.lokiUrl,
        liveUrl: p.liveUrl,
        live,
        session: byName.get(p.name.toLowerCase()) ?? null,
      };
    })
  );
  return { ok: true, projects: rows };
}

function liveWords(row: ProjectStatusRow): string {
  switch (row.live.state) {
    case 'up':
      return `live at ${row.liveUrl} (answered ${row.live.status} in ${row.live.ms} ms)`;
    case 'down':
      return `live site ${row.liveUrl} is DOWN: ${row.live.reason}`;
    case 'not_deployed':
      return 'not deployed';
    case 'not_checked':
      return `live site ${row.liveUrl} not checked: ${row.live.reason}`;
  }
}

/** One project as one line a person can read and a bot can quote. */
export function projectLine(row: ProjectStatusRow): string {
  const parts = [
    `**${row.name}**: ${row.status}${row.blockReason ? ` (${row.blockReason})` : ''}`,
    liveWords(row),
  ];
  if (row.currentWork) {
    parts.push(`now: ${row.currentWork}`);
  }
  if (row.queueDepth > 0) {
    parts.push(`${row.queueDepth} queued`);
  }
  if (row.session?.runId) {
    parts.push(`latest run ${row.session.runId}: ${row.session.label}`);
  }
  if (row.session?.reason) {
    parts.push(row.session.reason);
  }
  if (row.session?.prUrl) {
    parts.push(`PR ${row.session.prUrl}`);
  }
  if (row.feedback.new > 0 || row.feedback.open > 0) {
    parts.push(`inbox: ${row.feedback.new} new, ${row.feedback.open} open`);
  }
  return `- ${parts.join(' · ')}`;
}

export function projectStatusMessage(outcome: Extract<ProjectStatusOutcome, { ok: true }>): string {
  if (outcome.projects.length === 0) {
    return 'Loki has no projects for this account yet.';
  }
  const down = outcome.projects.filter(p => p.live.state === 'down').length;
  const unchecked = outcome.projects.filter(p => p.live.state === 'not_checked').length;
  const checked = outcome.projects.filter(p => p.live.state === 'up').length + down;
  const head = [
    down > 0
      ? `${down} live ${down === 1 ? 'site is' : 'sites are'} down.`
      : checked > 0
        ? `All ${checked} live ${checked === 1 ? 'site' : 'sites'} checked answered.`
        : 'No live site was checked.',
    unchecked > 0 ? `${unchecked} not checked.` : null,
  ]
    .filter(Boolean)
    .join(' ');
  return `${head}\n\n${outcome.projects.map(projectLine).join('\n')}`;
}
