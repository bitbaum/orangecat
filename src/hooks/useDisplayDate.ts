'use client';

/**
 * useDisplayDate — render dates the way this person reads them.
 *
 * The sibling of `useDisplayCurrency`, and deliberately shaped like it: read a
 * preference off the profile, fall back to something sensible, hand back
 * formatting functions.
 *
 * It does NOT reimplement any formatter. `@/utils/dates` and `@/utils/locale`
 * own them and both now take an optional format; this hook only decides WHICH
 * and binds it. Two copies of "how do I print a date" is precisely what the
 * group permission layer spent a refactor unwinding.
 *
 * Why two currencies below: `@/utils/dates` renders through date-fns patterns
 * and takes a `DateFormat`, while `@/utils/locale` renders through
 * `toLocaleString` and takes a locale tag. Both come from the same resolved
 * preference, and keeping that seam inside this one module is the point —
 * call sites see one vocabulary.
 */

import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';
import {
  resolveDateFormat,
  DATE_FORMATS,
  type DateFormat,
  type DateFormatPreference,
} from '@/config/date-formats';
import { formatDateTime, formatClockTime, formatOptionalDateTime } from '@/utils/locale';
import { formatDate, formatDateLong, formatIsoDay, formatTime } from '@/utils/dates';

/** The signals the inference chain reads, pulled off the loaded profile. */
function useDateSignals() {
  const profile = useAuthStore(state => state.profile);

  return useMemo(() => {
    const p = profile as Record<string, unknown> | null;
    return {
      preference: (p?.date_format as DateFormatPreference | undefined) ?? null,
      locationCountry: (p?.location_country as string | undefined) ?? null,
      currency: (p?.currency as string | undefined) ?? null,
      language: (p?.language as string | undefined) ?? null,
    };
  }, [profile]);
}

/** Which of the concrete formats this person gets. */
export function useUserDateFormat(): DateFormat {
  const signals = useDateSignals();
  return useMemo(() => resolveDateFormat(signals), [signals]);
}

interface UseDisplayDateReturn {
  /** Just the date: "22 Jul 2026". */
  formatDate: (value: string | Date) => string;
  /** The day spelled out, for article datelines: "22 July 2026". */
  formatDateLong: (value: string | Date) => string;
  /** 'YYYY-MM-DD' read as calendar digits, never as an instant. */
  formatIsoDay: (iso: string) => string;
  /** Date and time together, for timestamps shown in full. */
  formatDateTime: (value: string | number | Date) => string;
  /** A timestamp that may not exist yet — renders '—' when absent. */
  formatOptionalDateTime: (value: string | null | undefined) => string;
  /** Clock time, 12- or 24-hour depending on the format. */
  formatTime: (value: string | Date) => string;
  /** Clock time via Intl, for "saved at" style feedback. */
  formatClockTime: (value: string | number | Date) => string;
  /** The resolved format, for a caller that needs to pass it on. */
  format: DateFormat;
  /** The resolved BCP-47 tag, for the rare caller that needs Intl directly. */
  locale: string;
}

export function useDisplayDate(): UseDisplayDateReturn {
  const format = useUserDateFormat();
  const locale = DATE_FORMATS[format].locale;

  return {
    formatDate: useCallback(v => formatDate(v, format), [format]),
    formatDateLong: useCallback(v => formatDateLong(v, locale), [locale]),
    formatIsoDay: useCallback(iso => formatIsoDay(iso, format), [format]),
    formatDateTime: useCallback(v => formatDateTime(v, locale), [locale]),
    formatOptionalDateTime: useCallback(v => formatOptionalDateTime(v, locale), [locale]),
    formatTime: useCallback(v => formatTime(v, format), [format]),
    formatClockTime: useCallback(v => formatClockTime(v, locale), [locale]),
    format,
    locale,
  };
}
