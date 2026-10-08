/**
 * The listing decides what a booking request asks for. A studio rented by the
 * day was asked for a start AND an end date-time; these pin the mapping from
 * listing columns to the picker so it cannot drift back.
 */
import { assetBookingShape, serviceBookingShape } from '@/domain/bookings/shape';

describe('assetBookingShape', () => {
  it('asks for days, never times, unless the rental is hourly', () => {
    expect(assetBookingShape({ rental_period_type: 'daily' }).unit).toBe('day');
    expect(assetBookingShape({ rental_period_type: 'weekly' }).unit).toBe('day');
    expect(assetBookingShape({ rental_period_type: 'monthly' }).unit).toBe('day');
    expect(assetBookingShape({}).unit).toBe('day');
    expect(assetBookingShape({ rental_period_type: 'hourly' }).unit).toBe('hour');
  });
});

describe('serviceBookingShape', () => {
  it('maps opening days, hours and zone from the availability schedule', () => {
    const shape = serviceBookingShape({
      availability_schedule: {
        days: ['monday', 'wednesday', 'sunday'],
        hours: [{ start: '10:00', end: '16:00' }],
        timezone: 'Europe/Zurich',
      },
    });
    expect(shape).toEqual({
      unit: 'hour',
      hours: { start: '10:00', end: '16:00' },
      openWeekdays: [1, 3, 0],
      lengths: undefined,
      zone: 'Europe/Zurich',
    });
  });

  it('turns a fixed duration into the only length', () => {
    expect(serviceBookingShape({ duration_minutes: 90 }).lengths).toEqual([90]);
    expect(serviceBookingShape({ duration_minutes: 0 }).lengths).toBeUndefined();
  });

  it('leaves out what the listing does not say — every day, default hours, booker zone', () => {
    const shape = serviceBookingShape({ availability_schedule: null });
    expect(shape.openWeekdays).toBeUndefined();
    expect(shape.hours).toBeUndefined();
    expect(shape.zone).toBeNull();
  });

  it('ignores a zone the runtime does not know', () => {
    expect(
      serviceBookingShape({ availability_schedule: { days: ['monday'], timezone: 'CET+1' } }).zone
    ).toBeNull();
  });
});
