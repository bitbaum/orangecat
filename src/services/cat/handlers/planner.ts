/**
 * `tasks_read`, `calendar_read`, `calendar_add` and `calendar_remove`: the
 * person's own to-do list and calendar.
 *
 * The bodies are services/planner/hands.ts, shared with a bot's own work
 * loop. (create_task, complete_task and update_task are the planner's too;
 * they stay registered in productivity.ts beside set_reminder.)
 */
import { PLANNER_HANDS } from '@/services/planner/hands';
import type { ActionHandler } from './types';

const viaPlanner =
  (id: string): ActionHandler =>
  (supabase, userId, _actorId, params) =>
    PLANNER_HANDS[id](supabase, userId, params, 'cat');

export const plannerHandlers: Record<string, ActionHandler> = {
  tasks_read: viaPlanner('tasks_read'),
  calendar_read: viaPlanner('calendar_read'),
  calendar_add: viaPlanner('calendar_add'),
  calendar_remove: viaPlanner('calendar_remove'),
};
