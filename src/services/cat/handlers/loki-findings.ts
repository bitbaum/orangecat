/**
 * `file_loki_finding` and `loki_finding_status` — a bot reports what it found
 * on a live app into the project's own feedback inbox in Loki.
 *
 * Filed, never fixed: the report waits for the project's owner. The display
 * message carries the report id, which is what the status is read with.
 */
import {
  fileLokiFinding,
  findingFiledMessage,
  findingStatusMessage,
  readLokiFindingStatus,
} from '@/services/loki/findings';
import type { ActionHandler } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

export const lokiFindingHandlers: Record<string, ActionHandler> = {
  file_loki_finding: async (_supabase, _userId, actorId, params) => {
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

  loki_finding_status: async (_supabase, _userId, actorId, params) => {
    const id = text(params.report_id).trim();
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
