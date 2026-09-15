/**
 * Shared date formatting utilities — SSOT for display-layer date/time formatting.
 * Eliminates duplicate formatDate/formatTime/formatRelativeTime definitions
 * scattered across components. Uses date-fns (already installed).
 */
import { format, formatDistanceToNow } from 'date-fns';
import { APP_LOCALE } from '@/utils/locale';

export function formatDate(date: string | Date): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'MMM d, yyyy');
}

/**
 * The same day, spelled out: "July 22, 2026". For article datelines, where the
 * abbreviated form reads like a log entry.
 */
export function formatDateLong(date: string | Date): string {
  return (typeof date === 'string' ? new Date(date) : date).toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const ISO_DAY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * 'YYYY-MM-DD' → 'Jul 22, 2026', read as calendar digits and never as an
 * instant. `new Date('2026-07-22')` is UTC midnight, so west of Greenwich the
 * other formatters here render the day before — and render it differently on
 * the server than in the browser, which is a hydration mismatch. A date with
 * no time in it has no timezone; this formatter is the one that acts like it.
 */
export function formatIsoDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${ISO_DAY_MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

export function formatTime(date: string | Date): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'h:mm a');
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

export function formatRelativeTimeCompact(date: string | Date): string {
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
  return formatDate(d);
}
