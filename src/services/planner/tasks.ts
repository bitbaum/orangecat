/**
 * A person's own to-do list: the bodies behind create_task, set_reminder,
 * complete_task and update_task, and the read of what is still open.
 *
 * Two callers run them, as with the Loki hands: the Cat's handlers, and a
 * bot's work loop when its owner switched that hand to "on its own". One
 * body each, so both get the same parsing, the same refusals and the same
 * words. Every one checks the row is the person's own before it touches it:
 * a routine runs with the service-role client, where row-level security
 * does not.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { TASK_STATUSES } from '@/config/tasks';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { APP_LOCALE } from '@/utils/locale';
import { parseReminderDate } from './when';

export interface PlannerOutcome {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function createTask(
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<PlannerOutcome> {
  // DB columns: current_status (not status), task_type enum: one_time|recurring_scheduled|recurring_as_needed,
  // category enum: cleaning|maintenance|admin|inventory|it|kitchen|workshop|logistics|other,
  // priority enum: low|normal|high|urgent (not medium — map 'medium' defensively)
  const rawPriority = (params.priority as string) || 'normal';
  const priority = rawPriority === 'medium' ? 'normal' : rawPriority;
  // Accept both `description` and `notes` — system prompt documents `notes`
  const description =
    (params.description as string | null) || (params.notes as string | null) || null;

  const { data, error } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .insert({
      created_by: userId,
      title: params.title,
      description,
      priority,
      task_type: 'one_time',
      category: 'other',
      current_status: TASK_STATUSES.IDLE,
      // "Friday" from a model is not a timestamp; an unreadable date is no date.
      due_date: params.due_date ? parseReminderDate(String(params.due_date)) : null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  const taskTitle = params.title as string;
  const dueNote = params.due_date ? ` — due ${params.due_date}` : '';
  return {
    success: true,
    data: { ...data, displayMessage: `✅ Task created: "${taskTitle}"${dueNote}` },
  };
}

export async function setReminder(
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<PlannerOutcome> {
  // System prompt documents: title, due_date (ISO or natural language), notes
  // Handler also accepts legacy aliases: message (→title), when (→due_date)
  const title =
    (params.title as string | undefined) || (params.message as string | undefined) || '';
  const when = (params.due_date as string | undefined) || (params.when as string | undefined) || '';
  const notes = (params.notes as string | undefined) || null;

  if (!title) {
    return { success: false, error: 'title is required for set_reminder' };
  }

  // Parse natural-language or ISO "when" into a stored ISO timestamp.
  // Supports: "in N minutes/hours/days", "tomorrow", "next week", specific ISO strings.
  const dueDate = parseReminderDate(when);

  const description = notes ? `Reminder set by My Cat\nNotes: ${notes}` : `Reminder set by My Cat`;

  const { data, error } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .insert({
      created_by: userId,
      title,
      description,
      priority: 'normal',
      task_type: 'one_time',
      category: 'other',
      current_status: TASK_STATUSES.IDLE,
      is_reminder: true,
      due_date: dueDate,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const dueDateDisplay = dueDate
    ? new Date(dueDate).toLocaleString(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : when || 'no date set';

  return {
    success: true,
    data: {
      ...data,
      displayMessage: `Reminder set for ${dueDateDisplay}: "${title}"`,
    },
  };
}

export async function completeTask(
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<PlannerOutcome> {
  const taskId = params.task_id as string;
  const notes = (params.notes as string | null) || null;

  // First fetch the task to confirm it belongs to this user and isn't already completed
  const { data: task, error: taskError } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .select('id, title, task_type, is_completed, created_by')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return { success: false, error: 'Task not found' };
  }

  if (task.created_by !== userId) {
    return { success: false, error: 'You can only complete your own tasks' };
  }

  if (task.is_completed && task.task_type === 'one_time') {
    return { success: false, error: `Task "${task.title}" is already completed` };
  }

  // Insert into task_completions — the DB trigger handles status reset and one-time completion
  const { error: completionError } = await supabase.from(DATABASE_TABLES.TASK_COMPLETIONS).insert({
    task_id: taskId,
    completed_by: userId,
    completed_at: new Date().toISOString(),
    notes,
    duration_minutes: null,
  });

  if (completionError) {
    return { success: false, error: completionError.message };
  }

  return {
    success: true,
    data: {
      task_id: taskId,
      title: task.title,
      displayMessage: `✅ Marked "${task.title}" as completed`,
    },
  };
}

export async function updateTask(
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<PlannerOutcome> {
  // Update mutable fields of a task/reminder. Ownership is verified via created_by.
  // Accepts natural-language due_date (same parser as set_reminder).
  const taskId = params.task_id as string;

  // Fetch to verify ownership and get current title for display
  const { data: task, error: fetchError } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .select('id, title, created_by')
    .eq('id', taskId)
    .single();

  if (fetchError || !task) {
    return { success: false, error: 'Task not found' };
  }

  if (task.created_by !== userId) {
    return { success: false, error: 'You can only update your own tasks' };
  }

  // Build the update payload — only include fields the caller explicitly provided
  const updates: Record<string, unknown> = {};

  if (params.title !== undefined) {
    updates.title = params.title as string;
  }
  if (params.notes !== undefined) {
    updates.description = params.notes as string;
  }
  if (params.priority !== undefined) {
    const rawPriority = params.priority as string;
    updates.priority = rawPriority === 'medium' ? 'normal' : rawPriority;
  }
  if (params.due_date !== undefined) {
    const parsed = parseReminderDate(params.due_date as string);
    updates.due_date = parsed;
  }

  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      error: 'No fields to update — provide at least one of: title, notes, due_date, priority',
    };
  }

  const { data, error } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .update(updates)
    .eq('id', taskId)
    .eq('created_by', userId)
    .select('id, title, due_date, priority')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const updatedTitle =
    ((data as Record<string, unknown>)?.title as string) ?? (task.title as string);
  const dueDateDisplay = updates.due_date
    ? new Date(updates.due_date as string).toLocaleString(APP_LOCALE, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;
  const displayMessage = dueDateDisplay
    ? `📅 Updated "${updatedTitle}" — now due ${dueDateDisplay}`
    : `✏️ Updated "${updatedTitle}"`;

  return { success: true, data: { ...data, displayMessage } };
}

/** How many open tasks a read hands over: a list to act on, not an archive. */
export const OPEN_TASKS_MAX = 25;

export interface OpenTask {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  isReminder: boolean;
}

/** The person's open tasks and reminders: what is due soonest first, undated last. */
export async function readOpenTasks(
  supabase: AnySupabaseClient,
  userId: string
): Promise<OpenTask[] | null> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .select('id, title, due_date, priority, is_reminder')
    .eq('created_by', userId)
    .eq('is_completed', false)
    .eq('is_archived', false)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(OPEN_TASKS_MAX);
  if (error) {
    return null;
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map(t => ({
    id: String(t.id),
    title: String(t.title ?? ''),
    dueDate: (t.due_date as string | null) ?? null,
    priority: String(t.priority ?? 'normal'),
    isReminder: t.is_reminder === true,
  }));
}

/** The list as a model and a person both read it; each line carries the id a change needs. Pure. */
export function openTasksText(tasks: readonly OpenTask[], now: Date = new Date()): string {
  if (tasks.length === 0) {
    return 'Nothing is open on your to-do list.';
  }
  const line = (t: OpenTask) => {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const when = due
      ? `${due.getTime() < now.getTime() ? 'overdue since' : 'due'} ${t.dueDate!.slice(0, 16).replace('T', ' ')} UTC`
      : 'no date';
    const flag = t.priority === 'urgent' || t.priority === 'high' ? ` · ${t.priority}` : '';
    return `- ${t.title}${t.isReminder ? ' (reminder)' : ''} · ${when}${flag} [task_id: ${t.id}]`;
  };
  return [`${tasks.length} open on your to-do list:`, ...tasks.map(line)].join('\n');
}
