/**
 * What a booking request should ask for, decided by the listing.
 *
 * The dialog used to ask everyone for a start AND an end date-time — two raw
 * datetime-local fields — including for a studio rented by the day. The
 * listing already knows better: an asset rented per day/week/month needs
 * days, an hourly one a start time; a service has opening hours, open
 * weekdays, a zone and sometimes a fixed duration. This turns those columns
 * into the props of @bitbaum/whenkit's BookingRequestPicker. Pure — no I/O.
 */
import type { DailyHours } from '@bitbaum/whenkit';
import type { DayOfWeek } from '@/config/schedule';
import { parseAvailability } from '@/lib/availability';
import { isValidTimeZone } from '@/utils/timezone';

export interface BookingShape {
  unit: 'hour' | 'day';
  hours?: DailyHours;
  /** 0 = Sunday … 6 = Saturday; omitted = every day. */
  openWeekdays?: number[];
  /** One value = a fixed duration (no length choice). */
  lengths?: number[];
  /** The listing's zone when it states one; null = the booker's clock. */
  zone: string | null;
}

const WEEKDAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function serviceBookingShape(service: {
  availability_schedule?: unknown;
  duration_minutes?: number | null;
}): BookingShape {
  const availability = parseAvailability(service.availability_schedule);
  const range = availability.hours?.[0];
  const duration = service.duration_minutes;
  return {
    unit: 'hour',
    hours: range ? { start: range.start, end: range.end } : undefined,
    openWeekdays: availability.days?.length
      ? availability.days.map(day => WEEKDAY_INDEX[day])
      : undefined,
    lengths: typeof duration === 'number' && duration > 0 ? [duration] : undefined,
    zone: isValidTimeZone(availability.timezone) ? availability.timezone : null,
  };
}

export function assetBookingShape(asset: { rental_period_type?: unknown }): BookingShape {
  // Per day, week or month: the request is a run of days. Only an hourly
  // rental asks for a time.
  return { unit: asset.rental_period_type === 'hourly' ? 'hour' : 'day', zone: null };
}
