/**
 * After a bot starts an agent session, wait for it and read what it said.
 *
 * A task sent to Loki is answered in minutes, not at once. A bot that asks
 * the model "is it done yet?" in a loop burns steps and money and still
 * reports nothing. So the waiting is done here, in code: read the run until
 * its state settles or the time is up, then read the conversation of THAT
 * run's own session once. The first read asks Loki to watch the session for
 * the whole wait, so the runner streams the conversation while the agent
 * works: otherwise a one-off session that closes when it reports leaves
 * nothing to read. What comes back is Loki's own state, the agent's own
 * handoff and its words, quoted; if the time ran out, it says so and names
 * the run to read later.
 */
import { readLokiSessions, sessionLine, sessionsMessage } from './sessions';
import type { LokiTaskProjectResult } from './task-dispatch';

/** States in which a run may still change (Loki's canonical words). */
const IN_FLIGHT: ReadonlySet<string> = new Set(['queued', 'starting', 'working']);

export interface FollowOptions {
  /** How long to wait for the run to settle. */
  waitMs?: number;
  intervalMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export const FOLLOW_WAIT_MS = 90_000;
const FOLLOW_INTERVAL_MS = 6_000;

export interface FollowedRun {
  project: string;
  runId: string;
  /** The run settled inside the wait. */
  settled: boolean;
  /** What to show the person and hand the bot: state, then the conversation. */
  text: string;
}

/** The first sent project that carries a run to follow, if any. */
export function runToFollow(
  results: readonly LokiTaskProjectResult[] | undefined
): { project: string; runId: string } | null {
  const row = (results ?? []).find(r => r.ok && r.runId);
  return row?.runId ? { project: row.project, runId: row.runId } : null;
}

export async function followLokiRun(
  actorId: string,
  target: { project: string; runId: string },
  opts: FollowOptions = {}
): Promise<FollowedRun> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  const until = now() + (opts.waitMs ?? FOLLOW_WAIT_MS);
  const interval = opts.intervalMs ?? FOLLOW_INTERVAL_MS;

  // Watch for the whole wait plus the final read.
  const watch = Math.ceil((until - now()) / 1000) + 60;
  let statusLine: string | null = null;
  let settled = false;
  let first = true;
  for (;;) {
    const status = await readLokiSessions({
      actorId,
      runId: target.runId,
      ...(first ? { watch } : {}),
    });
    first = false;
    if (status.ok && status.sessions[0]) {
      statusLine = sessionLine(status.sessions[0]);
      settled = !IN_FLIGHT.has(status.sessions[0].state);
    }
    if (settled || now() + interval > until) {
      break;
    }
    await sleep(interval);
  }

  const talk = await readLokiSessions({ actorId, runId: target.runId, items: 12 });
  const head = settled
    ? `Run ${target.runId} on ${target.project} has settled.`
    : `Run ${target.runId} on ${target.project} is still going after the wait. Read it again later with loki_run_status.`;
  const body = talk.ok
    ? sessionsMessage(talk)
    : [statusLine, talk.reason].filter(Boolean).join('\n') || 'Loki could not be read just now.';
  return { project: target.project, runId: target.runId, settled, text: `${head}\n\n${body}` };
}
