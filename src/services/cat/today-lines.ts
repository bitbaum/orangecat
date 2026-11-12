/**
 * WHAT NEEDS YOU TODAY — the lines over the Cat's empty chat.
 *
 * The owner's test, his words (2026-11-02, bitbaum/loki
 * scripts/openclaw/day-plan/morning-brief.md): "he reads it and taps once. He
 * never has to type, and he never wonders what should I do with this. A line
 * without a tap or a decision does not belong here." So every line here is an
 * ACTION with the ONE link that does it, at most three of them, and never a
 * count: "1 overdue task and 14 unread notifications" was the first draft of
 * this file and failed that test on every clause.
 *
 * Loki owns the day (orangecat src/config/ecosystem.ts, ECOSYSTEM_PILLARS:
 * "what the day holds … there is nowhere else"), so this is not a second day
 * plan: it is what needs the person, from both sides of the rail, and one
 * link to their day in Loki. Deterministic — opening the chat calls no model
 * (standing rule, 2026-09-25).
 */

import { ROUTES } from '@/config/routes';
import { lokiPageUrl } from '@/config/ecosystem';
import {
  CAT_TODAY_MAX_LINES,
  DAY_LINK_LABELS,
  dayPartFor,
  type CatToday,
  type CatTodayLine,
  type DayPart,
} from '@/config/cat-prompts';
import { APP_LOCALE } from '@/utils/locale';
import { isValidTimeZone } from '@/utils/timezone';
import type { FullUserContext } from '@/services/ai/document-context-types';
import { MAX_TITLE_CHARS, truncate } from './cat-home-text';

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

const dateIn = (iso: string, zone: string): string =>
  new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: zone, day: 'numeric', month: 'short' });

/**
 * Loki writes "awaiting_user"; agents before the code was split wrote
 * "awaiting_user — <why>". Both mean the project waits on its owner.
 */
const waitsOnOwner = (p: { status: string; blockReason: string | null }): boolean =>
  p.status === 'blocked' && !!p.blockReason?.startsWith('awaiting_user');

/**
 * Every line that could be shown, most pressing first:
 *
 *   1. what Loki marks urgent (a site down, a hole)      → Loki's page for it
 *   2. a project Loki is waiting on, in Loki's words     → that project
 *   3. a booking today                                   → the booking
 *   4. a task overdue or due today                       → the task
 *   5. a decision waiting in Loki (an approval)          → /approvals
 *   6. a message waiting for a reply                     → the thread
 *   7. new visitor feedback on a project                 → its feedback tab
 */
export function todayCandidates(
  context: FullUserContext,
  now: Date = new Date(),
  zone?: string | null
): CatTodayLine[] {
  const clock = localClock(now, zone ?? context.profile?.timezone);
  const lines: CatTodayLine[] = [];
  const loki = context.lokiProjects ?? [];
  const lokiItems = context.lokiNeedsYou ?? [];
  const name = (s: string) => truncate(s, MAX_TITLE_CHARS);

  for (const item of lokiItems.filter(i => i.urgent)) {
    lines.push({ key: `loki:${item.key}`, text: item.label, href: item.href, urgent: true });
  }

  const waiting = loki.filter(waitsOnOwner);
  for (const p of waiting) {
    lines.push({
      key: `loki-project:${p.id}`,
      // Loki's own sentence when it sent one; an older Loki sends none, and
      // "answer Loki" is still an action with a place to do it.
      text: p.needsYou ? `${name(p.name)}: ${p.needsYou}` : `Answer Loki on ${name(p.name)}`,
      href: p.lokiUrl,
    });
  }

  for (const b of context.inboundActivity?.upcomingBookings ?? []) {
    if (!b.id || dayIn(b.starts_at, clock.zone) !== clock.day) {
      continue;
    }
    const who = b.customer_display_name || b.customer_username;
    lines.push({
      key: `booking:${b.id}`,
      text: `Booking${who ? ` with ${who}` : ''} at ${timeIn(b.starts_at, clock.zone)}`,
      href: ROUTES.DASHBOARD.BOOKINGS_VIEW(b.id),
    });
  }

  // The context loads only open tasks, so a past due date is overdue.
  const dated = context.tasks.filter(t => !!t.due_date);
  const overdue = dated.filter(t => dayIn(t.due_date as string, clock.zone) < clock.day);
  const dueToday = dated.filter(t => dayIn(t.due_date as string, clock.zone) === clock.day);
  for (const t of overdue) {
    lines.push({
      key: `task:${t.id}`,
      text: `${name(t.title)} — due ${dateIn(t.due_date as string, clock.zone)}`,
      href: ROUTES.DASHBOARD.TASKS_VIEW(t.id),
    });
  }
  for (const t of dueToday) {
    lines.push({
      key: `task:${t.id}`,
      text: `${name(t.title)} — due today`,
      href: ROUTES.DASHBOARD.TASKS_VIEW(t.id),
    });
  }

  for (const item of lokiItems.filter(i => !i.urgent)) {
    lines.push({
      key: `loki:${item.key}`,
      // An approval's title is what Loki proposes ("Email Anna about the
      // lease"); "Decide:" says what the tap is for.
      text: item.key.startsWith('approval:') ? `Decide: ${item.label}` : item.label,
      href: item.href,
    });
  }

  for (const c of context.conversations ?? []) {
    const who = c.other_name || (c.other_username ? `@${c.other_username}` : null);
    if (!c.has_unread || c.last_message_is_mine || !who) {
      continue;
    }
    lines.push({
      key: `reply:${c.id}`,
      text: `Reply to ${who}`,
      href: ROUTES.MESSAGES_WITH_CONVERSATION(c.id),
    });
  }

  const listed = new Set(waiting.map(p => p.id));
  for (const p of loki) {
    if (p.feedback.new > 0 && !listed.has(p.id)) {
      lines.push({
        key: `loki-feedback:${p.id}`,
        text: `Read the new feedback on ${name(p.name)}`,
        href: `${p.lokiUrl}#feedback`,
      });
    }
  }

  return lines;
}

/**
 * The home's "today": at most three lines, and the person's day in Loki when
 * they use it. Null for someone the Cat knows nothing about, whose empty chat
 * is the starter fork, not an empty to-do list.
 */
export function composeToday(
  context: FullUserContext,
  now: Date = new Date(),
  zone?: string | null
): CatToday {
  const clock = localClock(now, zone ?? context.profile?.timezone);
  const seen = new Set<string>();
  const lines = todayCandidates(context, now, zone).filter(l => {
    if (seen.has(l.key)) {
      return false;
    }
    seen.add(l.key);
    return true;
  });
  return {
    lines: lines.slice(0, CAT_TODAY_MAX_LINES),
    day:
      context.lokiProjects !== null && context.lokiProjects !== undefined
        ? { label: DAY_LINK_LABELS[clock.part], href: lokiPageUrl('/today') }
        : null,
  };
}
