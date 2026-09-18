/**
 * Shared date formatting utilities — SSOT for display-layer date/time formatting.
 * Eliminates duplicate formatDate/formatTime/formatRelativeTime definitions
 * scattered across components. Uses date-fns (already installed).
 *
 * These take a `DateFormat` rather than a locale, because they render through
 * date-fns patterns rather than `toLocaleDateString`. That distinction is why
 * `check:app-locale` never saw this file: `'MMM d, yyyy'` contains no `toLocale`
 * or `Intl` call, so the gate meant to keep dates consistent was watching only
 * the other half of the app while the larger half wrote American dates.
 *
 * The default is `month-first`, which is exactly what these rendered before, so
 * a caller that has not been given the viewer's format is unchanged rather than
 * silently restyled. Components should get the format from `useDisplayDate()`
 * or render `<FormattedDate />` instead of passing it by hand.
 */
import { format, formatDistanceToNow } from 'date-fns';
import { APP_LOCALE } from '@/utils/locale';
import { DATE_FORMATS, type DateFormat } from '@/config/date-formats';

/** What this module rendered before it could be told otherwise. */
const DEFAULT_FORMAT: DateFormat = 'month-first';

const toDate = (date: string | Date): Date => (typeof date === 'string' ? new Date(date) : date);

export function formatDate(date: string | Date, fmt: DateFormat = DEFAULT_FORMAT): string {
  return format(toDate(date), DATE_FORMATS[fmt].pattern);
}

/**
 * The same day, spelled out: "July 22, 2026". For article datelines, where the
 * abbreviated form reads like a log entry.
 */
export function formatDateLong(date: string | Date, locale: string = APP_LOCALE): string {
  return toDate(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 'YYYY-MM-DD' → 'Jul 22, 2026', read as calendar digits and never as an
 * instant. `new Date('2026-07-22')` is UTC midnight, so west of Greenwich the
 * other formatters here render the day before — and render it differently on
 * the server than in the browser, which is a hydration mismatch. A date with
 * no time in it has no timezone; this formatter is the one that acts like it.
 */
export function formatIsoDay(iso: string, fmt: DateFormat = DEFAULT_FORMAT): string {
  const [y, m, d] = iso.split('-').map(Number);
  // Local midnight, never UTC — that is the whole point of this function, and
  // date-fns formats a Date in local time, so the guarantee survives.
  return format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1), DATE_FORMATS[fmt].pattern);
}

export function formatTime(date: string | Date, fmt: DateFormat = DEFAULT_FORMAT): string {
  return format(toDate(date), DATE_FORMATS[fmt].timePattern);
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(typeof date === 'string' ? new Date(date) : date, {
    addSuffix: true,
  });
}

export function formatShortTime(date: string | Date): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'HH:mm');
}

/**
 * Human-readable duration from minutes: 45 → "45 min", 180 → "3 h",
 * 90 → "1 h 30 min". Returns '' for non-positive/invalid input so callers
 * can conditionally render.
 */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
    return '';
  }
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

/**
 * Relative time at MINUTE granularity: "just now", "45m ago", "3h ago".
 *
 * Distinct from formatRelativeTimeCompact, which starts at "Today" and so
 * cannot say how long ago something happened within a day. A feed needs the
 * fine answer; a profile's "joined" line does not. The group activity feed
 * carried a private copy of this because the coarse one was all we exported,
 * so two "x ago" dialects rendered on adjacent screens.
 */
export function formatRelativeTimeFine(
  date: string | Date,
  fmt: DateFormat = DEFAULT_FORMAT
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return formatDate(d, fmt);
}

export function formatRelativeTimeCompact(
  date: string | Date,
  fmt: DateFormat = DEFAULT_FORMAT
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}w ago`;
  }
  return formatDate(d, fmt);
}
