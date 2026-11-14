/**
 * How a day reads on the planner's pages: "Today", "Tomorrow", then
 * "Mon 16 Nov". The words are whenkit's (the platform's own, per locale).
 */
import { dayLabel, type ISODate } from '@bitbaum/whenkit';
import { APP_LOCALE } from '@/utils/locale';

export function dayHeading(day: ISODate, today: ISODate): string {
  const label = dayLabel(day, { locale: APP_LOCALE, today });
  return label.relative ? `${label.relative} · ${label.short}` : label.short;
}

export function dayChip(day: ISODate, today: ISODate): string {
  const label = dayLabel(day, { locale: APP_LOCALE, today });
  return label.relative ?? label.short;
}

/** The person's own today, as the browser's clock has it. */
export function browserToday(): ISODate {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
