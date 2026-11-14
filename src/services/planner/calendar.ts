/**
 * A person's own calendar, and the one agenda everything is read from.
 *
 * An entry is theirs: they typed it, or their Cat or one of their bots wrote
 * it for them (`made_by` says which). The agenda is the answer to "what do I
 * have next week": their own entries, the tasks and reminders that fall due,
 * and, where they connected one, their Google calendar. One list in time
 * order, so no model has to know there were three places to look.
 *
 * Every write checks the row is the person's own: a routine runs with the
 * service-role client, where row-level security does not.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { listCalendarEvents } from '@/services/connectors/google-read';
import { getGoogleConnection } from '@/services/google/connection';
import { hasUtcOffset, instantToWallTime, isValidTimeZone, wallTimeToUtc } from '@/utils/timezone';
import type { PlannerOutcome } from './tasks';
import { parseReminderDate } from './when';

export const AGENDA_DAYS_DEFAULT = 7;
export const AGENDA_DAYS_MAX = 62;
const ENTRIES_MAX = 200;
const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AgendaSource = 'calendar' | 'task' | 'reminder' | 'google';

export interface AgendaItem {
  source: AgendaSource;
  /** The row to change or remove; absent for what lives elsewhere. */
  id?: string;
  title: string;
  /** An instant, or YYYY-MM-DD for an all-day entry from outside. */
  start: string;
  end?: string | null;
  allDay: boolean;
  location?: string | null;
  /** Who wrote an own entry: 'me', 'cat', or a bot's id. */
  madeBy?: string;
}

/** How many days ahead, from what was asked: 1 to 62, a week when unsaid. Pure. */
export function agendaDays(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, AGENDA_DAYS_MAX) : AGENDA_DAYS_DEFAULT;
}

/**
 * A time as a person or a model writes it, as an instant. "2026-11-16T09:00"
 * with no offset is the wall clock in the person's zone, not UTC: nine in
 * Zürich is not nine in London. Pure.
 */
export function parseWhen(value: unknown, zone: string | null): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/.test(text) && !hasUtcOffset(text)) {
    const wall = text.length === 10 ? `${text}T00:00` : text.replace(' ', 'T').slice(0, 16);
    return zone && isValidTimeZone(zone) ? wallTimeToUtc(wall, zone) : `${wall}:00.000Z`;
  }
  return parseReminderDate(text);
}

const clean = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** Put something in the person's calendar. `madeBy`: 'me', 'cat', or a bot's id. */
export async function addCalendarEntry(
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>,
  opts: { madeBy?: string; zone?: string | null } = {}
): Promise<PlannerOutcome> {
  const title = clean(params.title, 200);
  if (!title) {
    return { success: false, error: 'A calendar entry needs a title.' };
  }
  const zone = opts.zone ?? null;
  const startsAt = parseWhen(params.start, zone);
  if (!startsAt) {
    return {
      success: false,
      error:
        'A calendar entry needs "start": a date and time such as 2026-11-16T09:00, or a date alone for a whole day. Ask the user when.',
    };
  }
  const endsAt = parseWhen(params.end, zone);
  if (endsAt && endsAt < startsAt) {
    return { success: false, error: 'It cannot end before it starts.' };
  }
  const allDay =
    params.all_day === true ||
    params.all_day === 'true' ||
    (typeof params.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.start.trim()));
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_ENTRIES)
    .insert({
      user_id: userId,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      location: clean(params.location, 300),
      notes: clean(params.notes, 2000),
      made_by: (opts.madeBy ?? 'me').slice(0, 64),
    })
    .select('id, title, starts_at, ends_at, all_day, location')
    .single();
  if (error) {
    return { success: false, error: 'That could not be added to your calendar just now.' };
  }
  const row = data as { id: string; starts_at: string };
  return {
    success: true,
    data: {
      ...(data as Record<string, unknown>),
      displayMessage: `Added to your calendar: "${title}" on ${whenText(row.starts_at, allDay, zone)} [entry_id: ${row.id}]`,
    },
  };
}

/** Take an own entry out. An id that is not this person's entry removes nothing. */
export async function removeCalendarEntry(
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>
): Promise<PlannerOutcome> {
  const id = typeof params.entry_id === 'string' ? params.entry_id.trim() : '';
  if (!UUID.test(id)) {
    return {
      success: false,
      error: 'An entry is removed by the entry_id the calendar shows beside it.',
    };
  }
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_ENTRIES)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('title');
  const gone = !error && Array.isArray(data) ? (data[0] as { title?: string } | undefined) : null;
  if (!gone) {
    return { success: false, error: 'No such entry in your calendar.' };
  }
  return {
    success: true,
    data: { entry_id: id, displayMessage: `Removed from your calendar: "${gone.title ?? ''}"` },
  };
}

export interface Agenda {
  days: number;
  items: AgendaItem[];
  /** Why the Google calendar is not in the list, when it was meant to be. */
  googleNote: string | null;
}

interface EntryRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  made_by: string;
}
interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  is_reminder: boolean;
}

async function ownEntries(
  supabase: AnySupabaseClient,
  userId: string,
  now: Date,
  until: string
): Promise<EntryRow[]> {
  try {
    const { data } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_ENTRIES)
      .select('id, title, starts_at, ends_at, all_day, location, made_by')
      .eq('user_id', userId)
      // Still running counts: an entry that started this morning is on today.
      .gte('starts_at', new Date(now.getTime() - DAY_MS).toISOString())
      .lte('starts_at', until)
      .order('starts_at', { ascending: true })
      .limit(ENTRIES_MAX);
    return (data ?? []) as unknown as EntryRow[];
  } catch {
    return [];
  }
}

async function dueTasks(
  supabase: AnySupabaseClient,
  userId: string,
  from: string,
  until: string
): Promise<TaskRow[]> {
  try {
    const { data } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .select('id, title, due_date, is_reminder')
      .eq('created_by', userId)
      .eq('is_completed', false)
      .eq('is_archived', false)
      .gte('due_date', from)
      .lte('due_date', until)
      .order('due_date', { ascending: true })
      .limit(ENTRIES_MAX);
    return (data ?? []) as unknown as TaskRow[];
  } catch {
    return [];
  }
}

/** An agenda item's place in time, for sorting: a bare date counts from its midnight. */
const at = (item: AgendaItem) =>
  Date.parse(item.start.length === 10 ? `${item.start}T00:00:00Z` : item.start);

/** The person's next days, from every place they keep them. Never throws. */
export async function readAgenda(
  supabase: AnySupabaseClient,
  userId: string,
  daysAsked: unknown,
  now: Date = new Date(),
  deps: { google?: typeof readGoogleEvents } = {}
): Promise<Agenda> {
  const days = agendaDays(daysAsked);
  const from = now.toISOString();
  const until = new Date(now.getTime() + days * DAY_MS).toISOString();
  const [entries, tasks, google] = await Promise.all([
    ownEntries(supabase, userId, now, until),
    dueTasks(supabase, userId, from, until),
    (deps.google ?? readGoogleEvents)(userId, days, now).catch(() => ({ items: [], note: null })),
  ]);
  const items: AgendaItem[] = [
    ...entries
      .filter(e => Date.parse(e.ends_at ?? e.starts_at) >= now.getTime() || e.all_day)
      .map(e => ({
        source: 'calendar' as const,
        id: e.id,
        title: e.title,
        start: e.starts_at,
        end: e.ends_at,
        allDay: e.all_day,
        location: e.location,
        madeBy: e.made_by,
      })),
    ...tasks.map(t => ({
      source: t.is_reminder ? ('reminder' as const) : ('task' as const),
      id: t.id,
      title: t.title,
      start: t.due_date,
      allDay: false,
    })),
    ...google.items,
  ].sort((a, b) => at(a) - at(b));
  return { days, items, googleNote: google.note };
}

/** The connected Google calendar as agenda items; nothing, silently, when none is connected. */
export async function readGoogleEvents(
  userId: string,
  days: number,
  now: Date
): Promise<{ items: AgendaItem[]; note: string | null }> {
  const connection = await getGoogleConnection(getAdminClient(), userId, now.getTime());
  if (!connection) {
    return { items: [], note: null };
  }
  const listed = await listCalendarEvents(connection.token, { days }, now);
  if (!listed.ok) {
    return { items: [], note: `Your Google calendar could not be read: ${listed.error}` };
  }
  return {
    note: null,
    items: listed.events.flatMap(e => {
      const start = e.start?.dateTime ?? e.start?.date;
      return start
        ? [
            {
              source: 'google' as const,
              title: e.summary || '(no title)',
              start,
              end: e.end?.dateTime ?? null,
              allDay: !e.start?.dateTime,
              location: e.location ?? null,
            },
          ]
        : [];
    }),
  };
}

/** A moment in the person's own clock, or in UTC and labelled so when their zone is unknown. Pure. */
export function whenText(start: string, allDay: boolean, zone: string | null): string {
  if (start.length === 10) {
    return `${start} (all day)`;
  }
  const local = zone && isValidTimeZone(zone);
  const wall = local ? instantToWallTime(start, zone) : start.slice(0, 16);
  const day = wall.slice(0, 10);
  if (allDay) {
    return `${day} (all day)`;
  }
  return `${day} ${wall.slice(11, 16)}${local ? '' : ' UTC'}`;
}

const SOURCE_WORD: Record<AgendaSource, string> = {
  calendar: '',
  task: ' · task due',
  reminder: ' · reminder',
  google: ' · Google calendar',
};

/** The agenda as a model and a person both read it. Pure. */
export function agendaText(agenda: Agenda, zone: string | null): string {
  const span = agenda.days === 1 ? 'the next day' : `the next ${agenda.days} days`;
  const lines = agenda.items.map(i => {
    const end =
      i.end && !i.allDay && i.start.length > 10
        ? ` to ${whenText(i.end, false, zone).slice(11)}`
        : '';
    const id =
      i.id && i.source === 'calendar' ? ` [entry_id: ${i.id}]` : i.id ? ` [task_id: ${i.id}]` : '';
    return `- ${whenText(i.start, i.allDay, zone)}${end} · ${i.title}${i.location ? ` · ${i.location}` : ''}${SOURCE_WORD[i.source]}${id}`;
  });
  return [
    lines.length > 0
      ? `${lines.length} in your calendar for ${span}${zone && isValidTimeZone(zone) ? ` (times in ${zone})` : ''}:`
      : `Nothing in your calendar for ${span}.`,
    ...lines,
    ...(agenda.googleNote ? [agenda.googleNote] : []),
  ].join('\n');
}
