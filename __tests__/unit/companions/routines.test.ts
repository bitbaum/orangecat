import { describe, expect, it } from 'vitest';
import {
  isTimeLocal,
  ROUTINE_INTERVALS,
  isRoutineInterval,
  nextRoutineRun,
  nextRunAt,
  routineNotice,
  skipReason,
} from '@/services/companions/routines-store';
import { ownerNoticeBody } from '@/services/loki/notify-owner';

/**
 * A bot that writes first: the next run is the next time of day in the
 * person's zone, strictly after now, and a routine runs only on the
 * person's own key.
 */
describe('nextRunAt', () => {
  it('is today when the time is still ahead, tomorrow when it has passed', () => {
    // 06:00 UTC on 2026-11-02 is 07:00 in Zürich (winter).
    const now = new Date('2026-11-02T06:00:00Z');
    expect(nextRunAt(now, '08:00', 'Europe/Zurich')).toBe('2026-11-02T07:00:00.000Z');
    expect(nextRunAt(now, '07:00', 'Europe/Zurich')).toBe('2026-11-03T06:00:00.000Z');
    expect(nextRunAt(now, '06:30', 'Europe/Zurich')).toBe('2026-11-03T05:30:00.000Z');
  });

  it('reads the time in the zone, not in UTC', () => {
    const now = new Date('2026-11-02T06:00:00Z');
    expect(nextRunAt(now, '08:00', 'America/New_York')).toBe('2026-11-02T13:00:00.000Z');
    expect(nextRunAt(now, '08:00', 'Asia/Tokyo')).toBe('2026-11-02T23:00:00.000Z');
  });

  it('is always after now', () => {
    const now = new Date('2026-03-29T00:30:00Z'); // the night Europe springs forward
    const next = new Date(nextRunAt(now, '02:30', 'Europe/Zurich')).getTime();
    expect(next).toBeGreaterThan(now.getTime());
  });
});

describe('a routine’s rules', () => {
  it('takes a time of day as HH:MM, 24 hours', () => {
    expect(isTimeLocal('08:00')).toBe(true);
    expect(isTimeLocal('23:59')).toBe(true);
    expect(isTimeLocal('24:00')).toBe(false);
    expect(isTimeLocal('8:00')).toBe(false);
    expect(isTimeLocal(800)).toBe(false);
  });

  it('runs only on the person’s own key', () => {
    expect(skipReason(true)).toBeNull();
    expect(skipReason(false)).toBe('needs_own_key');
  });
});

describe('a routine on the owner’s Telegram', () => {
  const notice = routineNotice({
    routineId: 'r1',
    assistantId: 'a1',
    botTitle: 'Day Planner',
    reply: 'Three things today: the tax form, the landlord, Ana’s present.',
    day: '2026-11-02',
  });

  it('is the bot’s words with one tap that opens its chat, silent', () => {
    const body = ownerNoticeBody(notice, 'https://orangecat.ch');
    expect(body.title).toBe('Day Planner');
    expect(body.body).toContain('Three things today');
    expect(body.actions).toEqual([
      { label: 'Open the chat', url: 'https://orangecat.ch/companions/talk?with=a1' },
    ]);
    expect(body.urgency).toBe('today');
    expect(body.actions[0].label.length).toBeLessThanOrEqual(24);
  });

  it('is one message per routine per day', () => {
    expect(notice.key).toBe('routine:r1:2026-11-02');
  });
});

describe('a routine that repeats through the day', () => {
  const now = new Date('2026-11-02T06:10:00.000Z');

  it('runs again that many hours after each run', () => {
    expect(nextRoutineRun(now, { timeLocal: '08:00', zone: 'Europe/Zurich', everyHours: 2 })).toBe(
      '2026-11-02T08:10:00.000Z'
    );
    expect(nextRoutineRun(now, { timeLocal: '08:00', zone: 'Europe/Zurich', everyHours: 1 })).toBe(
      '2026-11-02T07:10:00.000Z'
    );
  });

  it('keeps its hours: the next run steps from when it was due, not when the cron ran it', () => {
    const late = new Date('2026-11-02T08:14:00.000Z');
    expect(
      nextRoutineRun(late, {
        timeLocal: '08:00',
        zone: 'Europe/Zurich',
        everyHours: 2,
        dueAt: '2026-11-02T08:00:00.000Z',
      })
    ).toBe('2026-11-02T10:00:00.000Z');
    // Down for a day: the next run is the first still ahead, not a burst.
    expect(
      nextRoutineRun(late, {
        timeLocal: '08:00',
        zone: 'Europe/Zurich',
        everyHours: 4,
        dueAt: '2026-11-01T06:00:00.000Z',
      })
    ).toBe('2026-11-02T10:00:00.000Z');
  });

  it('is the daily routine when no interval, or one that is not offered, is set', () => {
    const daily = nextRunAt(now, '08:00', 'Europe/Zurich');
    for (const everyHours of [null, undefined, 0, 3, 48]) {
      expect(nextRoutineRun(now, { timeLocal: '08:00', zone: 'Europe/Zurich', everyHours })).toBe(
        daily
      );
    }
    expect(ROUTINE_INTERVALS.every(isRoutineInterval)).toBe(true);
    expect(isRoutineInterval('2')).toBe(false);
  });
});
