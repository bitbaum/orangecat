/**
 * Calendars a person keeps elsewhere, linked by their private iCal address.
 *
 * Every calendar service gives one: Google ("Secret address in iCal
 * format"), Apple (a shared iCloud calendar's public link), Outlook (a
 * published calendar's ICS link), Proton, Fastmail and the rest. It needs no
 * sign-in app on either side, which is why it is the first integration: it
 * works today, for every provider. It is read-only.
 *
 * The address grants read access to that calendar, so it is kept server-side
 * and never sent to a browser: the page sees a name, the provider and a hint.
 * Each file is fetched from public addresses only (pinned-get.ts), at most
 * 3 MB, and kept for a few minutes so a month view does not fetch it for
 * every redraw.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { PinnedGetRefused, pinnedGetText } from '@/lib/security/pinned-get';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import type { AgendaItem } from './calendar';
import { CalendarFileError, readCalendarFile } from './ics-read';

export const FEEDS_MAX = 10;
const FETCH_TIMEOUT_MS = 8_000;
const FILE_MAX_BYTES = 3 * 1024 * 1024;
const CACHE_MS = 5 * 60 * 1000;
const CACHE_ENTRIES = 200;

export type FeedProvider = 'google' | 'apple' | 'outlook' | 'other';

export interface LinkedCalendar {
  id: string;
  name: string;
  provider: FeedProvider;
  /** "calendar.google.com/…a1b2": enough to recognise it, not enough to read it. */
  hint: string;
  lastOkAt: string | null;
  lastError: string | null;
}

/** An address as people paste it, as one that can be fetched: webcal is https. Pure. */
export function normaliseFeedUrl(raw: string): string | null {
  const text = raw.trim().replace(/^webcals?:\/\//i, 'https://');
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Which service an address belongs to, from its host. Pure. */
export function feedProvider(url: string): FeedProvider {
  const host = new URL(url).hostname.toLowerCase();
  if (host === 'calendar.google.com' || host.endsWith('.google.com')) {
    return 'google';
  }
  const under = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (under('icloud.com')) {
    return 'apple';
  }
  if (under('outlook.com') || under('office365.com') || under('live.com') || under('office.com')) {
    return 'outlook';
  }
  return 'other';
}

/** "calendar.google.com/…a1b2": the host and the last four characters before the file ending. Pure. */
export function feedHint(url: string): string {
  const u = new URL(url);
  const tail = u.pathname
    .replace(/\/+$/, '')
    .replace(/(\/basic)?\.ics$/i, '')
    .slice(-4);
  return `${u.hostname}/…${tail}`;
}

const DEFAULT_NAME: Record<FeedProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  outlook: 'Outlook',
  other: 'Other calendar',
};

const cache = new Map<string, { at: number; text: string }>();

/** The file behind an address, from the cache when fresh. Throws a sentence for the person. */
async function fetchFile(url: string, now: number = Date.now()): Promise<string> {
  const hit = cache.get(url);
  if (hit && now - hit.at < CACHE_MS) {
    return hit.text;
  }
  let answer;
  try {
    answer = await pinnedGetText(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: FILE_MAX_BYTES,
      accept: 'text/calendar, */*',
    });
  } catch (error) {
    throw new CalendarFileError(
      error instanceof PinnedGetRefused
        ? `That address cannot be read: ${error.message}.`
        : 'That address did not answer. Check it and try again.'
    );
  }
  if (answer.status === 401 || answer.status === 403 || answer.status === 404) {
    throw new CalendarFileError(
      'That calendar is private or the link has changed. Copy its secret or public iCal link again.'
    );
  }
  if (answer.status < 200 || answer.status >= 300) {
    throw new CalendarFileError(`That address answered with an error (${answer.status}).`);
  }
  if (!/BEGIN:VCALENDAR/i.test(answer.text.slice(0, 2000))) {
    throw new CalendarFileError(
      'That address is a web page, not a calendar file. Use the iCal (.ics) link the calendar gives you.'
    );
  }
  if (cache.size >= CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(url, { at: now, text: answer.text });
  return answer.text;
}

interface FeedRow {
  id: string;
  name: string;
  url: string;
  provider: string;
  last_ok_at: string | null;
  last_error: string | null;
}

const toLinked = (r: FeedRow): LinkedCalendar => ({
  id: r.id,
  name: r.name,
  provider: (['google', 'apple', 'outlook'].includes(r.provider)
    ? r.provider
    : 'other') as FeedProvider,
  hint: feedHint(r.url),
  lastOkAt: r.last_ok_at,
  lastError: r.last_error,
});

async function feedRows(supabase: AnySupabaseClient, userId: string): Promise<FeedRow[]> {
  const { data } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_FEEDS)
    .select('id, name, url, provider, last_ok_at, last_error')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(FEEDS_MAX);
  return (data ?? []) as unknown as FeedRow[];
}

/** The person's linked calendars, without their addresses. */
export async function listLinkedCalendars(
  supabase: AnySupabaseClient,
  userId: string
): Promise<LinkedCalendar[]> {
  return (await feedRows(supabase, userId)).map(toLinked);
}

/**
 * Link a calendar: the address is fetched and read once first, so a wrong
 * link is refused with the reason instead of being kept and failing quietly.
 */
export async function linkCalendar(
  supabase: AnySupabaseClient,
  userId: string,
  input: { url: string; name?: string | null },
  now: Date = new Date()
): Promise<{ ok: true; calendar: LinkedCalendar; events: number } | { ok: false; error: string }> {
  const url = normaliseFeedUrl(input.url);
  if (!url) {
    return {
      ok: false,
      error: 'That is not a web address. Paste the iCal link the calendar gives you.',
    };
  }
  if ((await feedRows(supabase, userId)).length >= FEEDS_MAX) {
    return { ok: false, error: `You can link up to ${FEEDS_MAX} calendars.` };
  }
  const provider = feedProvider(url);
  const name = (input.name?.trim() || DEFAULT_NAME[provider]).slice(0, 80);
  let events = 0;
  try {
    const text = await fetchFile(url, now.getTime());
    events = readCalendarFile(text, now, new Date(now.getTime() + 31 * 86_400_000), name).length;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof CalendarFileError ? error.message : 'That calendar could not be read.',
    };
  }
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_FEEDS)
    .insert({ user_id: userId, name, url, provider, last_ok_at: now.toISOString() })
    .select('id, name, url, provider, last_ok_at, last_error')
    .single();
  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? 'That calendar is already linked.'
        : 'That calendar could not be saved just now.',
    };
  }
  return { ok: true, calendar: toLinked(data as unknown as FeedRow), events };
}

export async function unlinkCalendar(
  supabase: AnySupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_FEEDS)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * Every linked calendar's events in the span. A calendar that cannot be read
 * is left out and named in `notes`, and its row keeps the reason. Never throws.
 */
export async function readLinkedCalendars(
  supabase: AnySupabaseClient,
  userId: string,
  from: Date,
  until: Date
): Promise<{ items: AgendaItem[]; notes: string[] }> {
  let rows: FeedRow[];
  try {
    rows = await feedRows(supabase, userId);
  } catch {
    return { items: [], notes: [] };
  }
  const results = await Promise.all(
    rows.map(async row => {
      try {
        const items = readCalendarFile(await fetchFile(row.url), from, until, row.name);
        if (row.last_error) {
          await fromTable(supabase, DATABASE_TABLES.CALENDAR_FEEDS)
            .update({ last_error: null, last_ok_at: new Date().toISOString() })
            .eq('id', row.id);
        }
        return { items, note: null };
      } catch (error) {
        const reason =
          error instanceof CalendarFileError ? error.message : 'It could not be read just now.';
        logger.warn('linked calendar not read', { id: row.id, reason }, 'PlannerFeeds');
        await fromTable(supabase, DATABASE_TABLES.CALENDAR_FEEDS)
          .update({ last_error: reason.slice(0, 300) })
          .eq('id', row.id)
          .then(
            () => undefined,
            () => undefined
          );
        return { items: [], note: `Your ${row.name} calendar could not be read: ${reason}` };
      }
    })
  );
  return {
    items: results.flatMap(r => r.items),
    notes: results.flatMap(r => (r.note ? [r.note] : [])),
  };
}
