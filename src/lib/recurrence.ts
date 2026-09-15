/**
 * Turns an event's recurrence rule into one human sentence.
 *
 * `recurrence_pattern` is iCalendar-shaped JSONB (see `recurrencePatternSchema`
 * in lib/validation/social.ts). Its inner fields — frequency, interval,
 * days_of_week, day_of_month, month_of_year, end_date, count — were collected by
 * the create form and rendered by nothing: an event that repeats every Tuesday
 * displayed exactly like a one-off. Five of them sat in the check-dead-fields
 * baseline as a single unit precisely because they only mean anything together;
 * "day_of_month: 15" is not a fact you can show on its own.
 *
 * Day names come from WEEKDAYS in lib/availability.ts rather than a second list,
 * so weekday labels have one owner.
 */
import { WEEKDAYS } from '@/lib/availability';
import { APP_LOCALE } from '@/utils/locale';

/** Ordinal suffix for a day of the month: 1st, 2nd, 3rd, 4th… */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "Every 2 weeks" / "Daily" / "Every year" — the cadence clause. */
function cadence(frequency: unknown, interval: unknown): string {
  const every = typeof interval === 'number' && interval > 1 ? interval : 1;
  const unit: Record<string, string> = {
    daily: 'day',
    weekly: 'week',
    biweekly: '2 weeks',
    monthly: 'month',
    yearly: 'year',
  };
  const noun = typeof frequency === 'string' ? unit[frequency] : undefined;
  if (!noun) {
    return every > 1 ? `Every ${every} occurrences` : 'Repeats';
  }
  // biweekly already encodes its own interval; multiplying it would lie.
  if (frequency === 'biweekly') {
    return 'Every 2 weeks';
  }
  return every > 1 ? `Every ${every} ${noun}s` : `Every ${noun}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * @returns a display sentence, or null when the event does not repeat — callers
 * render nothing on null rather than an empty "Repeats" row.
 */
export function formatRecurrence(isRecurring: unknown, pattern: unknown): string | null {
  const p = isRecord(pattern) ? pattern : null;
  // Show the rule whenever one exists, not only when the boolean agrees: a
  // pattern with the flag unset is still the truth the user typed in.
  if (!isRecurring && !p) {
    return null;
  }
  if (!p) {
    return 'Repeats';
  }

  const parts: string[] = [cadence(p.frequency, p.interval)];

  const days = Array.isArray(p.days_of_week) ? p.days_of_week : [];
  if (days.length > 0) {
    const labels = WEEKDAYS.filter(d => days.includes(d.key)).map(d => d.short);
    if (labels.length > 0) {
      parts.push(`on ${labels.join(', ')}`);
    }
  } else if (typeof p.day_of_month === 'number') {
    const monthName =
      typeof p.month_of_year === 'number' && MONTHS[p.month_of_year - 1]
        ? ` of ${MONTHS[p.month_of_year - 1]}`
        : '';
    parts.push(`on the ${ordinal(p.day_of_month)}${monthName}`);
  }

  let sentence = parts.join(' ');

  if (typeof p.end_date === 'string' && p.end_date.trim()) {
    const d = new Date(p.end_date);
    if (!Number.isNaN(d.getTime())) {
      sentence += ` · until ${d.toLocaleDateString(APP_LOCALE, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })}`;
    }
  } else if (typeof p.count === 'number' && p.count > 0) {
    sentence += ` · ${p.count} time${p.count === 1 ? '' : 's'}`;
  }

  return sentence;
}
