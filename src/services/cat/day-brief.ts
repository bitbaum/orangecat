/**
 * THE DAY BRIEF — the Cat's first words in an empty chat.
 *
 * One opener that counts everything waiting on the person right now and
 * offers the reply that fits the hour ("Let's start my day"). Contract and
 * history: @/config/cat-prompts; how it sits with the other openers:
 * ./prompt-suggestions. Deterministic, like the rest of the home: no model is
 * called for opening a chat.
 */

import { DAY_BRIEF_REPLIES, dayPartFor, type CatOpener, type DayPart } from '@/config/cat-prompts';
import { APP_LOCALE } from '@/utils/locale';
import { isValidTimeZone } from '@/utils/timezone';
import type { FullUserContext } from '@/services/ai/document-context-types';
import { MAX_TITLE_CHARS, fingerprint, plural, truncate } from './cat-home-text';

/** Things the brief counts before it stops: a brief, not an inventory. */
const MAX_BRIEF_ITEMS = 4;

/** The person's wall clock: their calendar day, hour and part of day. */
export interface LocalClock {
  /** 'YYYY-MM-DD' in their zone. */
  day: string;
  hour: number;
  part: DayPart;
  zone: string;
}

/**
 * Read the clock in the person's zone. The server runs in UTC, so asking it
 * for "the hour" would wish Zürich good morning at lunchtime. An unknown zone
 * falls back to UTC rather than throw.
 */
export function localClock(now: Date, zone?: string | null): LocalClock {
  const tz = isValidTimeZone(zone) ? zone : 'UTC';
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    part: dayPartFor(hour),
    zone: tz,
  };
}

const dayIn = (iso: string, zone: string): string => localClock(new Date(iso), zone).day;

const timeIn = (iso: string, zone: string): string =>
  new Date(iso).toLocaleTimeString(APP_LOCALE, {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

/** "a", "a and b", "a, b and c". */
function list(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const PART_WORDS: Record<DayPart, string> = {
  morning: 'this morning',
  afternoon: 'this afternoon',
  evening: 'this evening',
};

/**
 * The Cat's first words of the day: what Loki is doing, then everything
 * waiting on the person, counted. Every clause is a count or a name read off
 * their own state — nothing here is advice, and nothing is invented. Deciding
 * what to DO about it is the conversation the reply starts.
 */
export function composeDayBrief(
  context: FullUserContext,
  now: Date = new Date(),
  zone?: string | null
): CatOpener {
  const clock = localClock(now, zone ?? context.profile?.timezone);
  const quote = (s: string) => `"${truncate(s, MAX_TITLE_CHARS)}"`;

  // ── Loki: the execution plane, in full sentences — it is someone else working ──
  const loki = context.lokiProjects ?? [];
  const waiting = loki.filter(p => p.status === 'blocked' && p.blockReason === 'awaiting_user');
  const building = loki.filter(p => p.status === 'working');
  const lokiSentences: string[] = [];
  if (waiting.length === 1) {
    lokiSentences.push(`Loki is waiting on you in ${quote(waiting[0].name)}.`);
  } else if (waiting.length > 1) {
    lokiSentences.push(`Loki is waiting on you in ${waiting.length} projects.`);
  }
  if (building.length === 1) {
    lokiSentences.push(`Loki is building ${quote(building[0].name)}.`);
  } else if (building.length > 1) {
    lokiSentences.push(`Loki is building ${building.length} projects.`);
  }

  // ── Everything waiting on the person, as counts ──
  const items: string[] = [];

  const bookings = (context.inboundActivity?.upcomingBookings ?? []).filter(
    b => dayIn(b.starts_at, clock.zone) === clock.day
  );
  if (bookings.length === 1) {
    const who = bookings[0].customer_display_name || bookings[0].customer_username;
    items.push(
      `a booking${who ? ` with ${who}` : ''} at ${timeIn(bookings[0].starts_at, clock.zone)}`
    );
  } else if (bookings.length > 1) {
    items.push(`${bookings.length} bookings today`);
  }

  const dated = context.tasks.filter(t => !!t.due_date);
  const dueToday = dated.filter(t => dayIn(t.due_date as string, clock.zone) === clock.day);
  const overdue = dated.filter(t => dayIn(t.due_date as string, clock.zone) < clock.day);
  if (dueToday.length > 0) {
    items.push(`${plural(dueToday.length, 'task')} due today`);
  }
  if (overdue.length > 0) {
    items.push(`${plural(overdue.length, 'overdue task')}`);
  }

  const feedback = loki.filter(p => p.feedback.new > 0);
  const feedbackTotal = feedback.reduce((n, p) => n + p.feedback.new, 0);
  if (feedback.length === 1) {
    items.push(`${plural(feedbackTotal, 'new piece')} of feedback on ${quote(feedback[0].name)}`);
  } else if (feedback.length > 1) {
    items.push(`${feedbackTotal} new pieces of feedback across ${feedback.length} projects`);
  }

  const unreadChats = (context.conversations ?? []).filter(c => c.has_unread).length;
  if (unreadChats > 0) {
    items.push(plural(unreadChats, 'unread conversation'));
  }

  const notifications = context.notifications ?? [];
  const unread =
    context.notificationsUnread ?? notifications.reduce((n, x) => n + (x.count || 1), 0);
  if (unread > 0) {
    items.push(plural(unread, 'unread notification'));
  }

  const shown = items.slice(0, MAX_BRIEF_ITEMS);
  const sentences = [...lokiSentences];
  if (shown.length > 0) {
    sentences.push(`You have ${list(shown)}.`);
  }
  const say =
    sentences.length > 0
      ? sentences.join(' ')
      : `Nothing is waiting on you ${PART_WORDS[clock.part]}.`;

  return {
    key: `day:${clock.day}:${clock.part}:${fingerprint(say)}`,
    say,
    replies: DAY_BRIEF_REPLIES[clock.part],
  };
}
