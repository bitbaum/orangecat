/**
 * Sending one task to several of the user's Loki projects.
 *
 * A request like "make it so I can post prompts in OrangeCat and Loki" is one
 * piece of work spread over several repositories. Loki owns everything about
 * running it — which names are real projects, which builder takes each one,
 * how the agents are told about each other — so this module only carries the
 * words across the signed rail and reports back what Loki said, in sentences
 * the model can repeat without inventing anything.
 *
 * What it must never do is report work as done. Loki answers when the task is
 * DISPATCHED (typed into a live session, or queued for a builder); the agents
 * take minutes to hours after that. Every sentence below says "sent", never
 * "built" or "changed".
 */
import { postSignedToLoki, lokiRailConfigured } from './signed-post';
import { logger } from '@/utils/logger';

const TASK_URL = process.env.LOKI_TASK_URL || 'https://loki.orangecat.ch/api/orangecat/task';

/** Mirrors Loki's own ceilings (lib/multi-dispatch-prompt.ts there). UX only:
 *  Loki checks again and its answer wins. */
export const LOKI_TASK_MAX_PROJECTS = 8;
export const LOKI_TASK_MAX_LENGTH = 4000;

export interface LokiTaskInput {
  /** OrangeCat actor the task runs for — Loki maps it to the linked account. */
  actorId: string;
  task: string;
  projects: string[];
  originUrl?: string;
}

export type LokiTaskProjectResult = {
  project: string;
  ok: boolean;
  mode?: 'direct' | 'queued';
  message?: string;
};

export type LokiTaskOutcome =
  | { ok: true; results: LokiTaskProjectResult[]; summary: string }
  | { ok: false; reason: string; available?: string[] };

/** Accepts an array or a comma/"and"-separated string — models produce both. */
export function parseProjectList(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.map(v => String(v))
    : typeof raw === 'string'
      ? raw.split(/,|\band\b|&|\n/i)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const name = p.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

export async function sendTaskToLoki(input: LokiTaskInput): Promise<LokiTaskOutcome> {
  if (!lokiRailConfigured()) {
    return {
      ok: false,
      reason:
        'Sending tasks to Loki is not configured on this deployment, so nothing was sent. Tell the user plainly.',
    };
  }
  const task = input.task.trim();
  if (!task) {
    return { ok: false, reason: 'The task is empty. Ask the user what the agents should do.' };
  }
  if (task.length > LOKI_TASK_MAX_LENGTH) {
    return {
      ok: false,
      reason: `The task is ${task.length} characters; Loki takes at most ${LOKI_TASK_MAX_LENGTH}. Nothing was sent. Ask the user to shorten it or split it in two.`,
    };
  }
  if (input.projects.length === 0) {
    return {
      ok: false,
      reason: 'No project was named. Ask the user which Loki projects should get this task.',
    };
  }
  if (input.projects.length > LOKI_TASK_MAX_PROJECTS) {
    return {
      ok: false,
      reason: `${input.projects.length} projects is more than the ${LOKI_TASK_MAX_PROJECTS} Loki takes at once. Nothing was sent. Ask the user to send it in two batches.`,
    };
  }

  const result = await postSignedToLoki(TASK_URL, {
    actorId: input.actorId,
    task,
    projects: input.projects,
    ...(input.originUrl ? { originUrl: input.originUrl } : {}),
  });

  if (!result.ok) {
    const parsed = safeJson(result.body);
    const detail = typeof parsed?.detail === 'string' ? parsed.detail : null;
    const available = Array.isArray(parsed?.available)
      ? (parsed.available as unknown[]).filter((v): v is string => typeof v === 'string')
      : undefined;
    logger.warn('[loki-task] refused', {
      actorId: input.actorId,
      status: result.status,
      projects: input.projects,
    });
    return {
      ok: false,
      reason: `Nothing was sent: ${detail ?? result.error}`,
      ...(available ? { available } : {}),
    };
  }

  const parsed = safeJson(result.body);
  const rows = Array.isArray(parsed?.results) ? (parsed.results as unknown[]) : null;
  if (!rows) {
    // A 2xx we cannot read is not a dispatch we may report.
    return {
      ok: false,
      reason:
        'Loki accepted the request but its answer could not be read, so it is unknown whether the agents got it. Tell the user to check Control in Loki rather than saying it was sent.',
    };
  }
  const results: LokiTaskProjectResult[] = rows.flatMap(r => {
    if (!r || typeof r !== 'object') {
      return [];
    }
    const row = r as Record<string, unknown>;
    if (typeof row.project !== 'string') {
      return [];
    }
    return [
      {
        project: row.project,
        ok: row.ok === true,
        mode: row.mode === 'queued' ? 'queued' : row.mode === 'direct' ? 'direct' : undefined,
        message: typeof row.message === 'string' ? row.message : undefined,
      },
    ];
  });
  return { ok: true, results, summary: summarise(results) };
}

/** The sentence the model repeats. Sent ≠ done, and a failure is named. */
export function summarise(results: LokiTaskProjectResult[]): string {
  const sent = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  const queued = sent.filter(r => r.mode === 'queued').map(r => r.project);
  const parts: string[] = [];
  if (sent.length > 0) {
    parts.push(
      `The task was SENT to ${sent.map(r => r.project).join(', ')} in Loki. Agents are starting on it; nothing has been changed yet.`
    );
  }
  if (queued.length > 0) {
    parts.push(
      `${queued.join(', ')} ${queued.length === 1 ? 'is' : 'are'} queued until a builder picks it up.`
    );
  }
  if (failed.length > 0) {
    parts.push(
      `NOT sent to ${failed.map(r => `${r.project} (${r.message ?? 'refused'})`).join(', ')}.`
    );
  }
  parts.push(
    'Progress shows in Loki → Control, and the outcome is announced when each agent finishes.'
  );
  return parts.join(' ');
}

function safeJson(text: string | undefined): Record<string, unknown> | null {
  if (!text) {
    return null;
  }
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
