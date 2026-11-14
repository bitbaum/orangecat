/**
 * A person's own planner, as functions of the person and the parameters:
 * their to-do list and their calendar. One body per hand.
 *
 * Two callers run them, as with the Loki hands and the connector reads: the
 * Cat's handlers, and a bot's work loop when its owner switched that hand to
 * "on its own". Nothing here leaves OrangeCat or is seen by anyone else: a
 * task or a calendar entry is private to its owner, which is why a bot may
 * be trusted to add one without a tap where publishing something may not.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getBotSettings } from '@/services/companions/rules';
import { addCalendarEntry, agendaText, readAgenda, removeCalendarEntry } from './calendar';
import {
  completeTask,
  createTask,
  openTasksText,
  readOpenTasks,
  updateTask,
  type PlannerOutcome,
} from './tasks';

export type PlannerHand = (
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  /** Who is writing: 'cat', or a bot's id. Kept on a calendar entry. */
  madeBy?: string
) => Promise<PlannerOutcome>;

/** The person's own time zone, when they set one (Settings → bot rules). */
async function zoneOf(supabase: AnySupabaseClient, userId: string): Promise<string | null> {
  return (await getBotSettings(supabase, userId).catch(() => null))?.timeZone ?? null;
}

const said = (text: string): PlannerOutcome => ({
  success: true,
  data: { text, displayMessage: text },
});

export const PLANNER_HANDS: Readonly<Record<string, PlannerHand>> = {
  /** What is open on the to-do list. Read-only. */
  tasks_read: async (supabase, userId) => {
    const tasks = await readOpenTasks(supabase, userId);
    return tasks
      ? said(openTasksText(tasks))
      : { success: false, error: 'Your to-do list could not be read just now.' };
  },
  create_task: (supabase, userId, params) => createTask(supabase, userId, params),
  complete_task: (supabase, userId, params) => completeTask(supabase, userId, params),
  update_task: (supabase, userId, params) => updateTask(supabase, userId, params),

  /** The coming days: own entries, what falls due, and a connected Google calendar. Read-only. */
  calendar_read: async (supabase, userId, params) => {
    const [agenda, zone] = await Promise.all([
      readAgenda(supabase, userId, params.days),
      zoneOf(supabase, userId),
    ]);
    return said(agendaText(agenda, zone));
  },
  calendar_add: async (supabase, userId, params, madeBy) =>
    addCalendarEntry(supabase, userId, params, {
      madeBy: madeBy ?? 'cat',
      zone: await zoneOf(supabase, userId),
    }),
  calendar_remove: (supabase, userId, params) => removeCalendarEntry(supabase, userId, params),
};

export function isPlannerHand(actionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PLANNER_HANDS, actionId);
}
