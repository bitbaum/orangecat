/**
 * "Put dentist on Monday at 9 in my calendar": an instruction to write, said
 * plainly enough that code can carry it out without asking a model.
 *
 * A model on the free pool may or may not call calendar_add, may put the
 * wrong day, or may say "done" and do nothing. So a message that names the
 * calendar as the place to put something, and says when, is written here,
 * in code, before the model answers; the model is then only told what was
 * added and confirms it in a sentence. A message that does not say when, or
 * does not name the calendar, is left to the model, which can ask.
 *
 * Pure. English and German, as the owner speaks both.
 */

import type { ISODate } from '@bitbaum/whenkit';
import { parseQuickAdd, type QuickAdd } from './quick-add';

/** Where the sentence says to put it. Taken out of the line before it is read. */
const INTO_CALENDAR =
  /\s*\b(?:in|into|to|on|onto)\s+(?:my|the)\s+(?:calendar|diary|agenda)\b|\s*\bin\s+(?:meinen|den|meinem)\s+kalender\b|^\s*(?:calendar|kalender)\s*:\s*/i;

/** The ways of asking: what comes before the thing itself. */
const ASKING =
  /^(?:(?:can|could|would) you\s+|bitte\s+|please\s+)?(?:put|add|schedule|book|block(?: out)?|note|save|set|enter|trag(?:e)?|setz(?:e)?|schreib(?:e)?|nimm)\s+/i;

/** "… ein" closes the German "trag … ein". */
const GERMAN_TAIL = /\s+ein\s*[.!]?\s*$/i;

/**
 * The entry a message asks to have written, or null when it does not plainly
 * ask for one: it must name the calendar, and say at least the day or the
 * time. `today` is the person's own day.
 */
export function calendarWriteIntent(message: string, today: ISODate): QuickAdd | null {
  const text = message
    .trim()
    .slice(0, 300)
    .replace(/[.!?]+$/, '');
  if (!INTO_CALENDAR.test(text)) {
    return null;
  }
  const named = text.replace(INTO_CALENDAR, ' ').trim();
  // A question about the calendar ("what is in my calendar tomorrow") is a
  // read: only a sentence that asks to put something there, or one that
  // starts "Calendar:", is a write.
  if (!ASKING.test(named) && !/^\s*(?:calendar|kalender)\s*:/i.test(text)) {
    return null;
  }
  const line = named.replace(ASKING, '').replace(GERMAN_TAIL, '').trim();
  const read = parseQuickAdd(line, today);
  if (!read.title || (!read.day && !read.time)) {
    return null;
  }
  // A time with no day said is today's.
  return { ...read, day: read.day ?? today };
}

/** The entry as the calendar's write takes it: a day alone is all day. Pure. */
export function entryParams(entry: QuickAdd): Record<string, unknown> {
  return {
    title: entry.title,
    start: entry.time ? `${entry.day}T${entry.time}` : entry.day,
    ...(entry.time ? { minutes: entry.minutes ?? 60 } : {}),
    ...(entry.place ? { location: entry.place } : {}),
  };
}
