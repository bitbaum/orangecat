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

/**
 * Day-first dates: "15 March 2027" rather than "March 15, 2027".
 *
 * Two surfaces — a project's target completion and a loan's origination and
 * maturity — deliberately read day-first, and each had 'en-GB' typed inline to
 * get it, which read as an accident and hid the intent. It is a FORMAT choice,
 * so it is named here next to the locale it deviates from.
 *
 * Open question for the product, not for a refactor: OrangeCat's audience is
 * largely Swiss and day-first is the local convention, so APP_LOCALE itself may
 * be the thing that is wrong. Changing that is one edit here and a sweep of the
 * date assertions — deliberately not done as part of a de-duplication pass.
 */
export const DAY_FIRST_LOCALE = 'en-GB';

/**
 * A timestamp that may not exist yet — "last used", "last delivered".
 *
 * Three settings cards each carried a byte-identical private copy of this,
 * six lines apart in the same directory, and jscpd never saw them because
 * three exact clones of fifteen tokens are below its window.
 */
export function formatOptionalDateTime(value: string | null | undefined): string {
  return value ? formatDateTime(value) : '—';
}

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
