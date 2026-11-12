/**
 * `send_task_to_loki` — the user writes a task once in Cat and it goes to
 * several of their Loki projects at the same time.
 *
 * The body is services/loki/hands.ts, shared with a bot's own work loop, so
 * a task sent by a tap and one sent by a bot its owner pre-approved are the
 * same task with the same words.
 */
import { LOKI_HANDS } from '@/services/loki/hands';
import type { ActionHandler } from './types';

export const lokiTaskHandlers: Record<string, ActionHandler> = {
  send_task_to_loki: (_supabase, _userId, actorId, params) =>
    LOKI_HANDS.send_task_to_loki(actorId, params),
};
