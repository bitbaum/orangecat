'use client';

/**
 * FormattedDate — a date in the viewer's format, usable from a server component.
 *
 * The sibling of `FormattedAmount`, and it exists for the same reason: the
 * preference lives on the profile, reading it needs a hook, and hooks do not
 * run in server components. Rendering on the client is the tradeoff, exactly as
 * it already is for amounts.
 *
 * Server-rendered surfaces with NO viewer keep `APP_LOCALE` and should not use
 * this — OG images, text assembled for the Cat, anything produced before a
 * profile is known. There is no "this person" to ask there, and guessing one is
 * worse than being consistently neutral.
 */

import { useDisplayDate } from '@/hooks/useDisplayDate';

interface FormattedDateProps {
  value: string | number | Date | null | undefined;
  /**
   * `date` (default) — "22 Jul 2026"
   * `long` — "22 July 2026", for article datelines
   * `datetime` — date and time together
   * `time` — the clock alone
   * `isoDay` — for a 'YYYY-MM-DD' string, read as calendar digits with no
   *   timezone. Use this for anything stored as a date rather than an instant,
   *   or it renders the previous day west of Greenwich.
   */
  mode?: 'date' | 'long' | 'datetime' | 'time' | 'isoDay';
  /** Rendered when the value is missing or unparseable. */
  fallback?: string;
  className?: string;
}

export function FormattedDate({
  value,
  mode = 'date',
  fallback = '—',
  className,
}: FormattedDateProps) {
  const { formatDate, formatDateLong, formatIsoDay, formatDateTime, formatTime } = useDisplayDate();

  if (value === null || value === undefined || value === '') {
    return <span className={className}>{fallback}</span>;
  }

  let rendered: string;
  if (mode === 'isoDay') {
    rendered = typeof value === 'string' ? formatIsoDay(value) : '';
  } else if (mode === 'datetime') {
    rendered = formatDateTime(value);
  } else if (mode === 'time') {
    rendered = formatTime(value as string | Date);
  } else if (mode === 'long') {
    rendered = formatDateLong(value as string | Date);
  } else {
    rendered = formatDate(value as string | Date);
  }

  return <span className={className}>{rendered || fallback}</span>;
}

export default FormattedDate;
