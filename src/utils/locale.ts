/**
 * The one locale this interface speaks.
 *
 * `toLocaleString()`, `toLocaleDateString()` and `toLocaleTimeString()` with no
 * locale argument use the BROWSER's locale, not the app's. The app ships
 * `<html lang="en">` and no translations, so on a German system that rendered
 * a post dated "22. Juli" next to a "1d" in the same metadata line, and a
 * character counter reading "118 / 5.000" — a thousands separator that an
 * English reader parses as five point zero.
 *
 * Eighteen call sites did this. They are not eighteen bugs; they are one bug
 * with eighteen instances, which is why this file exists rather than eighteen
 * patches. `scripts/check-app-locale.mjs` fails the build on a nineteenth.
 *
 * When the app does ship translations, this constant becomes the user's chosen
 * locale — one place to change, and still never the browser's, because the
 * language of the interface and the language of the operating system are
 * different questions.
 */
export const APP_LOCALE = 'en-US';

/** A number with grouping separators: 5000 → "5,000". */
export function formatNumber(value: number): string {
  return value.toLocaleString(APP_LOCALE);
}

/** Date and time together, for timestamps shown in full. */
export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(APP_LOCALE);
}

/** Just the clock time, for "saved at" style feedback. */
export function formatClockTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString(APP_LOCALE);
}

/**
 * A timestamp column that may be empty: the full date and time, or an em dash.
 * Three settings cards each declared this as `formatTimestamp`; the dash is a
 * table convention, so it belongs next to the formatter rather than beside
 * every table.
 */
export function formatDateTimeOrDash(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return formatDateTime(value);
}
