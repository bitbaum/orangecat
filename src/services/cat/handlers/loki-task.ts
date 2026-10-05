/**
 * `send_task_to_loki` — the user writes a task once in Cat and it goes to
 * several of their Loki projects at the same time.
 *
 * The honesty rule is the one build_site already lives by: Loki answers when
 * the task is dispatched, not when it is done, so the data handed back says
 * "sent" and names any project that did not get it.
 */
import { parseProjectList, sendTaskToLoki } from '@/services/loki/task-dispatch';
import type { ActionHandler } from './types';

export const lokiTaskHandlers: Record<string, ActionHandler> = {
  send_task_to_loki: async (_supabase, _userId, actorId, params) => {
    const task = typeof params.task === 'string' ? params.task : '';
    const projects = parseProjectList(params.projects);

    const outcome = await sendTaskToLoki({ actorId, task, projects });
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
      data: { results: outcome.results, status: outcome.summary },
    };
  },
};
