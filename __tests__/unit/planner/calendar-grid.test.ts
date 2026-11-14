import { describe, expect, it } from 'vitest';
import {
  daysFrom,
  layoutDay,
  monthDays,
  monthTitle,
  rangeFor,
  spanTitle,
  step,
  hourLabel,
  weekStart,
  weekdayNames,
} from '@/components/planner/calendar/grid';

describe('the calendar’s geometry', () => {
  it('starts a week on Monday', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-09'); // a Saturday
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // a Monday
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // a Sunday
    expect(weekdayNames()[0]).toMatch(/^Mon/);
  });

  it('shows whole weeks for a month, from the week of the 1st to the week of the last', () => {
    const nov = monthDays('2026-11-14');
    expect(nov[0]).toBe('2026-10-26');
    expect(nov[nov.length - 1]).toBe('2026-12-06');
    expect(nov.length % 7).toBe(0);
    expect(nov.length).toBe(42);
    // February 2027 starts on a Monday and needs only four or five weeks.
    const feb = monthDays('2027-02-10');
    expect(feb[0]).toBe('2027-02-01');
    expect(feb.length).toBe(28);
  });

  it('loads exactly what a view shows', () => {
    expect(rangeFor('month', '2026-11-14', 7)).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(rangeFor('week', '2026-11-14', 7)).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    // On a phone the week is three days from the one chosen.
    expect(rangeFor('week', '2026-11-14', 3)).toEqual({ from: '2026-11-14', to: '2026-11-16' });
    expect(rangeFor('list', '2026-11-14', 7)).toEqual({ from: '2026-11-14', to: '2026-12-14' });
  });

  it('steps a month, a week or three days at a time', () => {
    expect(step('month', '2026-11-14', 1, 7)).toBe('2026-12-01');
    expect(step('month', '2026-01-31', -1, 7)).toBe('2025-12-01');
    expect(step('week', '2026-11-14', 1, 7)).toBe('2026-11-21');
    expect(step('week', '2026-11-14', -1, 3)).toBe('2026-11-11');
  });

  it('names a month and a span', () => {
    expect(monthTitle('2026-11-14')).toBe('November 2026');
    expect(spanTitle('2026-11-16', '2026-11-22')).toMatch(/^Nov 16\s*–\s*22, 2026$/);
    expect(spanTitle('2026-11-30', '2026-12-06')).toMatch(/^Nov 30\s*–\s*Dec 6, 2026$/);
    expect(hourLabel(9)).toMatch(/^9\s?AM$/);
    expect(hourLabel(15)).toMatch(/^3\s?PM$/);
    expect(daysFrom('2026-11-30', 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });

  it('puts overlapping events side by side and the rest full width', () => {
    const at = (s: number, e: number, id: string) => ({ id, startMinute: s, endMinute: e });
    const placed = layoutDay([
      at(540, 600, 'a'), // 9:00–10:00
      at(570, 630, 'b'), // 9:30–10:30, overlaps a
      at(600, 660, 'c'), // 10:00–11:00, overlaps b, fits a's column
      at(720, 780, 'd'), // 12:00–13:00, alone
      { id: 'all-day', startMinute: null, endMinute: null },
    ]);
    const by = Object.fromEntries(placed.map(p => [p.item.id, [p.lane, p.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});
