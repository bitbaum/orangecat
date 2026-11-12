/**
 * What a person can do with their own Loki from OrangeCat, as functions of
 * the actor and the parameters: one body per hand.
 *
 * Two callers run them. The Cat's handlers (services/cat/handlers/loki-*.ts)
 * run one when the person taps a card. A bot's work loop
 * (services/companions/work-loop.ts) runs one directly when its owner
 * switched that hand to "on its own". Both get the same parsing, the same
 * refusals and the same words, because there is one body.
 *
 * Every one of them goes over the signed rail as the Loki account linked to
 * the actor, so none can reach anyone else's projects.
 */
import { askLokiAsPerson } from './ask';
import {
  fileLokiFinding,
  findingFiledMessage,
  findingStatusMessage,
  readLokiFindingStatus,
} from './findings';
import { projectStatusMessage, readProjectStatus } from './project-status';
import { readLokiSessions, sessionsMessage } from './sessions';
import { parseProjectList, sendTaskToLoki } from './task-dispatch';

export interface LokiHandOutcome {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type LokiHand = (
  actorId: string,
  params: Record<string, unknown>
) => Promise<LokiHandOutcome>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LOKI_HANDS: Readonly<Record<string, LokiHand>> = {
  /** A question to the person's own Loki, answered as them. Read-only. */
  ask_loki: async (actorId, params) => {
    const question = typeof params.question === 'string' ? params.question : '';
    const threadId = typeof params.thread_id === 'string' ? params.thread_id : undefined;
    const outcome = await askLokiAsPerson({ actorId, question, threadId });
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    return { success: true, data: { text: outcome.text, displayMessage: outcome.text } };
  },

  /** Every session's state, or one project's with what its agent last said. Read-only. */
  loki_sessions: async (actorId, params) => {
    const project = typeof params.project === 'string' ? params.project.trim() : '';
    const outcome = await readLokiSessions({ actorId, ...(project ? { project } : {}) });
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    return {
      success: true,
      data: {
        sessions: outcome.sessions,
        transcript: outcome.transcript,
        displayMessage: sessionsMessage(outcome),
      },
    };
  },

  /** Every project: what it is doing, its latest run and PR, and whether its live site answers. Read-only. */
  project_status: async (actorId, params) => {
    const project = typeof params.project === 'string' ? params.project.trim() : '';
    const outcome = await readProjectStatus(actorId, project ? { project } : {});
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    return {
      success: true,
      data: { projects: outcome.projects, displayMessage: projectStatusMessage(outcome) },
    };
  },

  /** One run on its way to live, by its full runId. Read-only. */
  loki_run_status: async (actorId, params) => {
    const runId = typeof params.run_id === 'string' ? params.run_id.trim() : '';
    if (!UUID.test(runId)) {
      return {
        success: false,
        error:
          'A run is read by its full runId, the one a sent task returned. Ask the user for it, or read loki_sessions for the latest run of a project.',
      };
    }
    const outcome = await readLokiSessions({ actorId, runId });
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    return {
      success: true,
      data: { sessions: outcome.sessions, displayMessage: sessionsMessage(outcome) },
    };
  },

  /**
   * One task to several projects' agent sessions. Loki answers when the task
   * is DISPATCHED, not when it is done, so the data says "sent" and names
   * any project that did not get it.
   */
  send_task_to_loki: async (actorId, params) => {
    const task = typeof params.task === 'string' ? params.task : '';
    const projects = parseProjectList(params.projects);
    const builder =
      params.builder === 'cloud' || params.builder === 'local' ? params.builder : undefined;
    const queueIfBusy = params.queue_if_busy === true || params.queue_if_busy === 'true';
    const freshSession = params.fresh_session === true || params.fresh_session === 'true';

    const outcome = await sendTaskToLoki({
      actorId,
      task,
      projects,
      ...(builder ? { builder } : {}),
      ...(queueIfBusy ? { queueIfBusy } : {}),
      ...(freshSession ? { separateSession: true } : {}),
    });
    if (!outcome.ok) {
      return {
        success: false,
        error: outcome.available?.length
          ? `${outcome.reason} Ask the user which of these they meant.`
          : outcome.reason,
      };
    }
    const anySent = outcome.results.some(r => r.ok);
    return {
      success: anySent,
      ...(anySent ? {} : { error: outcome.summary }),
      // The summary is the line the thread keeps: the runId in it is what a
      // bot reads the run back with.
      data: {
        results: outcome.results,
        status: outcome.summary,
        ...(anySent ? { displayMessage: outcome.summary } : {}),
      },
    };
  },

  /**
   * A defect found on a live app, filed into that project's feedback inbox.
   * Filed, never fixed: the report waits for the project's owner. The
   * message carries the report id, which is what the status is read with.
   */
  file_loki_finding: async (actorId, params) => {
    const text = (v: unknown): string => (typeof v === 'string' ? v : '');
    const outcome = await fileLokiFinding({
      actorId,
      project: text(params.project),
      finding: text(params.finding),
      agentName: text(params.filed_by) || 'OrangeCat bot',
      ...(text(params.url) ? { url: text(params.url) } : {}),
    });
    if (!outcome.ok) {
      return {
        success: false,
        error: outcome.available?.length
          ? `${outcome.reason} Ask the user which of these they meant.`
          : outcome.reason,
      };
    }
    return {
      success: true,
      data: {
        id: outcome.id,
        status: outcome.status,
        displayMessage: findingFiledMessage(outcome),
      },
    };
  },

  /** Where one filed finding is. Read-only. */
  loki_finding_status: async (actorId, params) => {
    const id = typeof params.report_id === 'string' ? params.report_id.trim() : '';
    if (!UUID.test(id)) {
      return {
        success: false,
        error: 'A report is read by its full id, the one filing it returned. Ask the user for it.',
      };
    }
    const outcome = await readLokiFindingStatus(actorId, id);
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    return {
      success: true,
      data: { state: outcome.state, displayMessage: findingStatusMessage(outcome) },
    };
  },
};

export function isLokiHand(actionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOKI_HANDS, actionId);
}
