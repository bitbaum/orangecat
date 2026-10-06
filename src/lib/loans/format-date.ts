import { DAY_FIRST_LOCALE } from '@/utils/locale';

/**
 * These date columns are `optionalText` in the schema, not timestamps, so the
 * stored value is whatever the form wrote. Render it as a date only when it
 * genuinely parses, and fall back to the raw string rather than printing
 * "Invalid Date" over the user's own input.
 *
 * Fixed to UTC on purpose: this renders on the server, which cannot know the
 * reader's timezone, and an unpinned format shifts a maturity date by a day
 * depending on where it happens to run.
 */
export const formatLoanDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }
  return parsed.toLocaleDateString(DAY_FIRST_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
