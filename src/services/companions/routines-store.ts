/**
 * A bot that writes first: the routine itself, and its rules.
 *
 * A routine is one line in a bot's details: every day at a time, in the
 * person's zone, or every few hours through the day, the bot is asked one
 * thing in its own thread and the reply lands there like any other message,
 * with a notification. One routine per
 * bot per person. This module reads and writes the row and knows when the
 * next run is; it reaches no model, so the API that sets a routine never
 * does either. The runner (routines.ts) is the one place a turn is sent.
 *
 * The budget rule (fleet, 2026-09-25): a key nobody asked to spend is never
 * spent on a timer. A routine runs only on the person's own key; without one
 * the due run is skipped and the reason is kept on the row, so the details
 * can say so and offer the way to lift it.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import type { OwnerNotice } from '@/services/loki/notify-owner';
import { instantToWallTime, isValidTimeZone, wallTimeToUtc } from '@/utils/timezone';

export const ROUTINE_PROMPT_MAX = 500;

/** How often a routine may repeat through the day, in hours. */
export const ROUTINE_INTERVALS = [1, 2, 4, 8, 12] as const;

export function isRoutineInterval(value: unknown): value is number {
  return typeof value === 'number' && (ROUTINE_INTERVALS as readonly number[]).includes(value);
}

export interface Routine {
  id: string;
  assistantId: string;
  conversationId: string | null;
  prompt: string;
  timeLocal: string;
  zone: string;
  /** Runs again this many hours after each run; null = once a day at timeLocal. */
  everyHours: number | null;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  skippedReason: string | null;
}

export type RoutineInput = {
  prompt: string;
  timeLocal: string;
  zone: string;
  everyHours?: number | null;
};

/** "HH:MM", 24 hours. */
export function isTimeLocal(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * The next instant at which `timeLocal` in `zone` falls strictly after `now`:
 * today's if it is still ahead, otherwise tomorrow's. Daylight-saving edges
 * are the wall-time helper's.
 */
export function nextRunAt(now: Date, timeLocal: string, zone: string): string {
  // YYYY-MM-DD in the zone: the wall-time helper's own rendering, cut at the day.
  const dayOf = (d: Date) => instantToWallTime(d.toISOString(), zone).slice(0, 10);
  for (let add = 0; add <= 2; add++) {
    const probe = new Date(now.getTime() + add * 86_400_000);
    const iso = wallTimeToUtc(`${dayOf(probe)}T${timeLocal}`, zone);
    if (iso && new Date(iso).getTime() > now.getTime()) {
      return iso;
    }
  }
  // Unreachable for a valid zone and time; the day after is a safe floor.
  return new Date(now.getTime() + 86_400_000).toISOString();
}

/**
 * When a routine runs next: that many hours from now when it repeats through
 * the day, otherwise the next time its hour of day comes round.
 */
export function nextRoutineRun(
  now: Date,
  routine: {
    timeLocal: string;
    zone: string;
    everyHours: number | null | undefined;
    /**
     * The run this one was due at. A repeating routine steps from there, not
     * from when the cron got to it (up to its 15-minute tick later), so it
     * keeps its hours instead of drifting later every run.
     */
    dueAt?: string | null;
  }
): string {
  if (isRoutineInterval(routine.everyHours)) {
    const step = routine.everyHours * 3_600_000;
    const due = routine.dueAt ? Date.parse(routine.dueAt) : NaN;
    let next = (Number.isFinite(due) ? due : now.getTime()) + step;
    // Missed runs (the box was down) are not run late in a burst: the next
    // one is the first still ahead.
    while (next <= now.getTime()) {
      next += step;
    }
    return new Date(next).toISOString();
  }
  return nextRunAt(now, routine.timeLocal, routine.zone);
}

export interface RoutineRow {
  id: string;
  user_id: string;
  assistant_id: string;
  conversation_id: string | null;
  prompt: string;
  time_local: string;
  zone: string;
  every_hours?: number | null;
  enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  skipped_reason: string | null;
}

export function toRoutine(r: RoutineRow): Routine {
  return {
    id: r.id,
    assistantId: r.assistant_id,
    conversationId: r.conversation_id,
    prompt: r.prompt,
    timeLocal: r.time_local,
    zone: r.zone,
    everyHours: isRoutineInterval(r.every_hours) ? r.every_hours : null,
    enabled: r.enabled,
    nextRunAt: r.next_run_at,
    lastRunAt: r.last_run_at,
    skippedReason: r.skipped_reason,
  };
}

export async function getRoutine(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId: string
): Promise<Routine | null> {
  const { data } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROUTINES)
    .select('*')
    .eq('user_id', userId)
    .eq('assistant_id', assistantId)
    .maybeSingle();
  return data ? toRoutine(data as RoutineRow) : null;
}

/** Set the bot's routine (one per bot per person); the next run is computed from now. */
export async function upsertRoutine(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId: string,
  input: RoutineInput,
  now = new Date()
): Promise<Routine> {
  if (!isTimeLocal(input.timeLocal) || !isValidTimeZone(input.zone)) {
    throw new Error('A routine needs a time of day and a zone');
  }
  const everyHours = isRoutineInterval(input.everyHours) ? input.everyHours : null;
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROUTINES)
    .upsert(
      {
        user_id: userId,
        assistant_id: assistantId,
        prompt: input.prompt.trim().slice(0, ROUTINE_PROMPT_MAX),
        time_local: input.timeLocal,
        zone: input.zone,
        every_hours: everyHours,
        enabled: true,
        next_run_at: nextRoutineRun(now, {
          timeLocal: input.timeLocal,
          zone: input.zone,
          everyHours,
        }),
        skipped_reason: null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id,assistant_id' }
    )
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return toRoutine(data as RoutineRow);
}

export async function deleteRoutine(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId: string
): Promise<void> {
  const { error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROUTINES)
    .delete()
    .eq('user_id', userId)
    .eq('assistant_id', assistantId);
  if (error) {
    throw error;
  }
}

/** The reason a due routine does not run, or null when it may. */
export function skipReason(hasOwnKey: boolean): string | null {
  return hasOwnKey ? null : 'needs_own_key';
}

/**
 * What a routine's message becomes on the owner's Telegram (through Loki's one
 * gateway, services/loki/notify-owner.ts, which sends only the owner's own
 * news and decides when). The owner, 2026-11-02: Telegram is "the way for any
 * bot of mine to contact me", and a message there is read and answered with
 * one tap. So: the bot's name, the first lines of what it wrote, one button
 * that opens its chat, silent ("today"), and one message per routine per day
 * (per run for a routine that repeats through the day: `day` then carries
 * the hour).
 */
export function routineNotice(input: {
  routineId: string;
  assistantId: string;
  botTitle: string;
  reply: string;
  day: string;
}): OwnerNotice {
  return {
    source: 'bots',
    title: input.botTitle,
    body: input.reply,
    action: { label: 'Open the chat', path: ROUTES.AI_ASSISTANTS.TALK_WITH(input.assistantId) },
    urgency: 'today',
    key: `routine:${input.routineId}:${input.day}`,
  };
}
