/**
 * One line, as a person says it, into the parts a calendar entry or a task
 * is made of: "Dentist Monday 9am for 30 min at Chur" → Dentist · Mon ·
 * 09:00 · 30 min · Chur.
 *
 * The planner's pages ask for one line (typed or dictated) and nothing
 * else; what this reads becomes the chips under the line, each one a tap to
 * change. It is rules, not a model: it answers as the person types, costs
 * nothing, and is the same on the weakest phone. What it does not recognise
 * simply stays in the title. English and German, as the owner speaks both.
 *
 * Pure. Days are `YYYY-MM-DD` and times `HH:MM`, wall-clock values; they
 * become an instant only where the entry is written, in the person's zone.
 */

import { addDays, isISODate, weekday, type ISODate, type WallTime } from '@bitbaum/whenkit';

export interface QuickAdd {
  title: string;
  day: ISODate | null;
  time: WallTime | null;
  /** How long, in minutes. */
  minutes: number | null;
  place: string | null;
}

/** A whole word, umlauts included: JavaScript's \b does not see "ü" as a letter. */
const word = (inner: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${inner})(?![\\p{L}\\p{N}])`, 'iu');

/**
 * Weekday names and their three-letter forms. The German two-letter forms
 * ("Do", "So", "Mi") are left out on purpose: they are also words, and
 * "Do the laundry" is not a Thursday.
 */
const WEEKDAYS: ReadonlyArray<readonly [string, number]> = [
  ['sun(?:day)?|sonntag', 0],
  ['mon(?:day)?|montag', 1],
  ['tue(?:s(?:day)?)?|dienstag', 2],
  ['wed(?:nesday)?|mittwoch', 3],
  ['thu(?:r(?:s(?:day)?)?)?|donnerstag', 4],
  ['fri(?:day)?|freitag', 5],
  ['sat(?:urday)?|samstag', 6],
];

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  mär: 3,
  apr: 4,
  may: 5,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  okt: 10,
  nov: 11,
  dec: 12,
  dez: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** A day and month as a date this year, or next year when that day has passed. */
function dated(day: number, month: number, today: ISODate, year?: number): ISODate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const y = year ?? Number(today.slice(0, 4));
  const iso = `${y}-${pad(month)}-${pad(day)}`;
  if (!isISODate(iso)) {
    return null;
  }
  return year || iso >= today ? iso : `${y + 1}-${pad(month)}-${pad(day)}`;
}

type Take<T> = { value: T; rest: string } | null;

/** Cut the first match out of the text, leaving one space where it was. */
function take(text: string, re: RegExp): { match: RegExpExecArray; rest: string } | null {
  const match = re.exec(text);
  return match
    ? { match, rest: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` }
    : null;
}

function takeLength(text: string): Take<number> {
  const hit = take(
    text,
    /\b(?:for|f[uü]r)?\s*(\d+(?:[.,]\d)?)\s*(min(?:ute[ns]?)?|m|h|hrs?|hours?|std|stunden?)\b/i
  );
  if (!hit) {
    return null;
  }
  const n = Number(hit.match[1].replace(',', '.'));
  const minutes = /^m/i.test(hit.match[2]) ? n : n * 60;
  return minutes >= 5 && minutes <= 24 * 60 ? { value: Math.round(minutes), rest: hit.rest } : null;
}

function takeTime(text: string): Take<WallTime> {
  const named = take(text, /\b(?:at |um )?(noon|mittags?|midnight|mitternacht)\b/i);
  if (named) {
    return { value: /^mi?d|^mitter/i.test(named.match[1]) ? '00:00' : '12:00', rest: named.rest };
  }
  // "9:30", "14.30", "9am", "9 pm", "at 9", "um 9", "9 uhr", "9h30".
  const hit =
    take(text, /\b(?:at |um )?(\d{1,2})[:.h](\d{2})\s*(am|pm|uhr)?\b/i) ??
    take(text, /\b(?:at |um )?(\d{1,2})()\s*(am|pm|uhr)\b/i) ??
    take(text, /\b(?:at|um) (\d{1,2})()()\b(?![.\/])/i);
  if (!hit) {
    return null;
  }
  let hour = Number(hit.match[1]);
  const minute = hit.match[2] ? Number(hit.match[2]) : 0;
  const half = (hit.match[3] ?? '').toLowerCase();
  if (half === 'pm' && hour < 12) {
    hour += 12;
  }
  if (half === 'am' && hour === 12) {
    hour = 0;
  }
  return hour <= 23 && minute <= 59
    ? { value: `${pad(hour)}:${pad(minute)}`, rest: hit.rest }
    : null;
}

function takeDay(text: string, today: ISODate): Take<ISODate> {
  const iso = take(text, /\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && isISODate(iso.match[1])) {
    return { value: iso.match[1], rest: iso.rest };
  }
  const relative: ReadonlyArray<readonly [RegExp, number]> = [
    [word('day after tomorrow|[uü]bermorgen'), 2],
    [word('tomorrow|morgen'), 1],
    [word('today|tonight|heute(?: abend)?'), 0],
    [word('next week|n[aä]chste woche'), 7],
  ];
  for (const [re, add] of relative) {
    const hit = take(text, re);
    if (hit) {
      return { value: addDays(today, add), rest: hit.rest };
    }
  }
  // "16.11.", "16.11.2026", "16/11"
  const numeric = take(text, /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\.?(?=\s|$)/);
  if (numeric) {
    const value = dated(
      Number(numeric.match[1]),
      Number(numeric.match[2]),
      today,
      numeric.match[3] ? Number(numeric.match[3]) : undefined
    );
    if (value) {
      return { value, rest: numeric.rest };
    }
  }
  // "16 Nov", "16. November", "Nov 16"
  const words =
    take(text, /\b(\d{1,2})\.?\s+([a-zä]{3})[a-zä]*\b/i) ??
    take(text, /\b([a-zä]{3})[a-zä]*\s+(\d{1,2})\b/i);
  if (words) {
    const [a, b] = [words.match[1], words.match[2]];
    const dayFirst = /^\d/.test(a);
    const month = MONTHS[(dayFirst ? b : a).toLowerCase()];
    const value = month ? dated(Number(dayFirst ? a : b), month, today) : null;
    if (value) {
      return { value, rest: words.rest };
    }
  }
  for (const [names, target] of WEEKDAYS) {
    const hit = take(text, word(`(?:on |am |next |n[aä]chsten? )?(?:${names})`));
    if (hit) {
      // The next such day; "Monday" said on a Monday means a week from now.
      const ahead = (target - weekday(today) + 7) % 7 || 7;
      return { value: addDays(today, ahead), rest: hit.rest };
    }
  }
  return null;
}

/** "… at Chur", "… in Zürich", "… bei Ana": a place is a capitalised tail. */
function takePlace(text: string): Take<string> {
  const hit = take(text, /\s(?:at|in|@|bei|im)\s+(\p{Lu}[\p{L}\p{N} .'’-]{1,60})\s*$/u);
  return hit ? { value: hit.match[1].trim(), rest: hit.rest } : null;
}

const LEAD_IN =
  /^(?:please\s+)?(?:put|add|schedule|remind me to|remind me|to-?do:?|task:?|erinnere mich an|erinner mich an|trag(?:e)? ein:?)\s+/i;

/** Read one line. `today` is the person's own day. Never throws. */
export function parseQuickAdd(line: string, today: ISODate): QuickAdd {
  let text = ` ${line.replace(/\s+/g, ' ').trim()} `;
  const out: QuickAdd = { title: '', day: null, time: null, minutes: null, place: null };
  const length = takeLength(text);
  if (length) {
    out.minutes = length.value;
    text = length.rest;
  }
  const day = takeDay(text, today);
  if (day) {
    out.day = day.value;
    text = day.rest;
  }
  const time = takeTime(text);
  if (time) {
    out.time = time.value;
    text = time.rest;
  }
  const place = takePlace(text.replace(/\s+/g, ' ').trimEnd());
  if (place) {
    out.place = place.value;
    text = place.rest;
  }
  out.title = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEAD_IN, '')
    .replace(/\s+(on|at|um|am|in|for|f[uü]r)$/i, '')
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, '');
  return out;
}
