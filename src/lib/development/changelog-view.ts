/**
 * How /changelog reads: each line's lead sentence as its headline, the last
 * month open and older days folded per month. The record (CHANGELOG.md, via
 * the fleet map) is unchanged; this only shapes it for a reader, so the phone
 * page is a few screens and not fifty.
 */
import { APP_LOCALE } from '@/utils/locale';

/** Days, counted back from the newest entry, that stay open. */
export const CHANGELOG_OPEN_DAYS = 30;

/**
 * Every entry is written "**Lead sentence.** The rest." and the map drops the
 * bold, so the lead is the first sentence. A line with one sentence is all
 * lead.
 */
export function splitLead(text: string): { lead: string; rest: string } {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(text.trim());
  if (!match) {
    return { lead: text.trim(), rest: '' };
  }
  return { lead: match[1], rest: match[2] };
}

export interface ChangelogMonth<T> {
  key: string;
  label: string;
  days: T[];
  lineCount: number;
}

/** Splits newest-first days into the open window and older months, newest first. */
export function groupChangelog<T extends { date: string; lines: unknown[] }>(
  days: T[],
  openDays: number = CHANGELOG_OPEN_DAYS
): { recent: T[]; months: ChangelogMonth<T>[] } {
  if (days.length === 0) {
    return { recent: [], months: [] };
  }
  const newest = Date.parse(`${days[0].date.slice(0, 10)}T00:00:00Z`);
  const cutoff = newest - openDays * 24 * 60 * 60 * 1000;
  const recent: T[] = [];
  const months: ChangelogMonth<T>[] = [];
  const monthName = new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  for (const day of days) {
    const at = Date.parse(`${day.date.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(at) || at > cutoff) {
      recent.push(day);
      continue;
    }
    const key = day.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = { key, label: monthName.format(at), days: [], lineCount: 0 };
      months.push(month);
    }
    month.days.push(day);
    month.lineCount += day.lines.length;
  }
  return { recent, months };
}
