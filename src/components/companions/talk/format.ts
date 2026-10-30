/**
 * The small words of the talk list: when something last happened, in the
 * way a messaging app says it — a time today, a weekday this week, a date
 * before that.
 */

import { APP_LOCALE } from '@/utils/locale';

const DAY_MS = 86_400_000;

export function whenLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) {
    return '';
  }
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return '';
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = startOfToday - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  if (diff <= 0) {
    return at.toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 6 * DAY_MS) {
    return at.toLocaleDateString(APP_LOCALE, { weekday: 'long' });
  }
  if (at.getFullYear() === now.getFullYear()) {
    return at.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short' });
  }
  return at.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Funes · keeps the books" — the name, and the job when it has one. */
export function nameWithJob(name: string, job: string | null | undefined): string {
  const clean = (job ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return name;
  }
  const short = clean.length > 40 ? `${clean.slice(0, 39)}…` : clean;
  return `${name} · ${short}`;
}

/** Accent- and case-insensitive "does this row match what was typed". */
export function matchesQuery(haystack: string, query: string): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  return !q || fold(haystack).includes(q);
}
