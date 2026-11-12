/**
 * `loki_sessions` and `loki_run_status` — reading the person's own Loki.
 *
 * Read-only on both sides. What comes back is Loki's own state, track and
 * transcript, quoted; the display message is the outcome the person reads
 * and the line the bot's next turn sees, so a bot can report a run's answer
 * without having made any of it up.
 */
import { readLokiSessions, sessionsMessage } from '@/services/loki/sessions';
import type { ActionHandler } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const lokiSessionsHandlers: Record<string, ActionHandler> = {
  loki_sessions: async (_supabase, _userId, actorId, params) => {
    const project = typeof params.project === 'string' ? params.project.trim() : '';
    const outcome = await readLokiSessions({ actorId, ...(project ? { project } : {}) });
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    const text = sessionsMessage(outcome);
    return {
      success: true,
      data: { sessions: outcome.sessions, transcript: outcome.transcript, displayMessage: text },
    };
  },

  loki_run_status: async (_supabase, _userId, actorId, params) => {
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
};
