/**
 * A person's own OrangeCat calendar as an address their phone's calendar can
 * subscribe to: https://orangecat.ch/api/calendar/feed/<secret>.ics
 *
 * The secret is the only key, so it is long (32 random bytes) and the person
 * can turn the link off (the row goes) or make a new one (the old stops).
 * The feed holds their own entries only: not tasks, not what was read from
 * Google or a linked calendar, which already live where they came from.
 */

import { todayIn } from '@bitbaum/whenkit';
import { randomBytes } from 'crypto';
import { API_ROUTES } from '@/config/api-routes';
import { SITE_URL } from '@/config/brand';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { getBotSettings } from '@/services/companions/rules';
import { writeCalendarFile, type FeedEvent } from './ics-write';

const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;
/** What a subscriber is given: the last month and the coming year. */
const PAST_DAYS = 31;
const AHEAD_DAYS = 366;
const ENTRIES_MAX = 2000;

export interface ShareLinks {
  /** https:// — to copy, or for Outlook's "subscribe from web". */
  https: string;
  /** webcal:// — opens Apple Calendar (and most desktop calendars) at once. */
  webcal: string;
  /** Google Calendar's own "add by URL" page with the address filled in. */
  google: string;
}

/** The three ways to hand the same feed to a calendar app. Pure. */
export function shareLinks(token: string, site: string = SITE_URL): ShareLinks {
  const https = new URL(API_ROUTES.CALENDAR.FEED(token), site).toString();
  const webcal = https.replace(/^https?:\/\//, 'webcal://');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}

export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN.test(value);
}

export async function readShare(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ShareLinks | null> {
  const { data } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_SHARE_TOKENS)
    .select('token')
    .eq('user_id', userId)
    .maybeSingle();
  const token = (data as { token?: string } | null)?.token;
  return token ? shareLinks(token) : null;
}

/** Make the link, or a new one in place of the old (which then stops working). */
export async function makeShare(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ShareLinks | null> {
  const token = randomBytes(32).toString('base64url');
  const { error } = await fromTable(supabase, DATABASE_TABLES.CALENDAR_SHARE_TOKENS).upsert(
    { user_id: userId, token, created_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  return error ? null : shareLinks(token);
}

export async function stopShare(supabase: AnySupabaseClient, userId: string): Promise<void> {
  await fromTable(supabase, DATABASE_TABLES.CALENDAR_SHARE_TOKENS).delete().eq('user_id', userId);
}

interface EntryRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  updated_at: string;
}

/**
 * The feed behind a secret, or null when no such link exists. `admin` must
 * be the service-role client: the person asking is a calendar app, not
 * signed in, and the secret is what proves the calendar is theirs to read.
 */
export async function feedForToken(
  admin: AnySupabaseClient,
  token: string,
  now: Date = new Date()
): Promise<string | null> {
  if (!isShareToken(token)) {
    return null;
  }
  const { data: owner } = await fromTable(admin, DATABASE_TABLES.CALENDAR_SHARE_TOKENS)
    .select('user_id')
    .eq('token', token)
    .maybeSingle();
  const userId = (owner as { user_id?: string } | null)?.user_id;
  if (!userId) {
    return null;
  }
  const zone = (await getBotSettings(admin, userId).catch(() => null))?.timeZone ?? null;
  const { data } = await fromTable(admin, DATABASE_TABLES.CALENDAR_ENTRIES)
    .select('id, title, starts_at, ends_at, all_day, location, notes, updated_at')
    .eq('user_id', userId)
    .gte('starts_at', new Date(now.getTime() - PAST_DAYS * 86_400_000).toISOString())
    .lte('starts_at', new Date(now.getTime() + AHEAD_DAYS * 86_400_000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(ENTRIES_MAX);
  const events: FeedEvent[] = ((data ?? []) as unknown as EntryRow[]).map(e => ({
    uid: e.id,
    title: e.title,
    // An all-day entry is stored at its midnight in the person's zone; its
    // day is that midnight read in the same zone.
    start: e.all_day ? dayIn(e.starts_at, zone) : e.starts_at,
    end: e.ends_at,
    allDay: e.all_day,
    location: e.location,
    notes: e.notes,
    updatedAt: e.updated_at,
  }));
  return writeCalendarFile('OrangeCat', events);
}

function dayIn(iso: string, zone: string | null): string {
  if (!zone) {
    return iso.slice(0, 10);
  }
  return todayIn(zone, new Date(iso));
}
