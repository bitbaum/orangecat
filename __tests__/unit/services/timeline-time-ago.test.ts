/**
 * A post's age is a glance, not a sentence.
 *
 * The post header rendered "about 23 hours ago" — date-fns with `addSuffix` —
 * three times the width of "23h" for the same fact, reading as prose inside a
 * metadata line. Every feed product converged on the compact form for the same
 * reason: in a feed, the age competes with the post.
 *
 * The timeline already had its own formatter for this; the header just reached
 * past it for the generic one. These tests pin the format so a future edit
 * cannot quietly widen it again.
 */

import { getTimeAgo } from '@/services/timeline/formatters';

const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('getTimeAgo', () => {
  it('says "now" for something that just happened', () => {
    expect(getTimeAgo(at(0))).toBe('now');
    expect(getTimeAgo(at(3 * SEC))).toBe('now');
  });

  it('never renders a negative age', () => {
    // Clock skew, or an optimistic post stamped microseconds in the future.
    // "now" is honest; "-1m" is a bug on screen.
    expect(getTimeAgo(new Date(Date.now() + 5 * SEC).toISOString())).toBe('now');
  });

  it('counts seconds, then minutes, then hours, then days', () => {
    expect(getTimeAgo(at(30 * SEC))).toBe('30s');
    expect(getTimeAgo(at(5 * MIN))).toBe('5m');
    expect(getTimeAgo(at(59 * MIN))).toBe('59m');
    expect(getTimeAgo(at(23 * HOUR))).toBe('23h');
    expect(getTimeAgo(at(6 * DAY))).toBe('6d');
  });

  it('carries no " ago" suffix', () => {
    // The position after the handle already says it is an age.
    for (const ms of [30 * SEC, 5 * MIN, 23 * HOUR, 6 * DAY]) {
      expect(getTimeAgo(at(ms))).not.toMatch(/ago/);
    }
  });

  it('switches to an absolute date past a week', () => {
    const out = getTimeAgo(at(30 * DAY));
    expect(out).not.toMatch(/\d+[smhd]$/);
    expect(out).toMatch(/\d/);
  });

  it('writes the date in English, whatever the browser locale is', () => {
    // The app ships <html lang="en"> and no translations. Taking the browser's
    // locale rendered "22. Juli" next to a "1d" in the same metadata line for
    // anyone on a non-English system.
    const out = getTimeAgo(at(30 * DAY));
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('keeps the year on older posts so they cannot read as recent', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(getTimeAgo(twoYearsAgo.toISOString())).toMatch(
      String(twoYearsAgo.getFullYear())
    );
  });

  it('drops the year within the current year', () => {
    // Pick a date in this year that is safely more than a week old.
    const now = new Date();
    const earlier = new Date(now.getFullYear(), 0, 2);
    if (now.getTime() - earlier.getTime() > 8 * DAY) {
      expect(getTimeAgo(earlier.toISOString())).not.toMatch(String(now.getFullYear()));
    }
  });

  it('returns empty for an unparseable timestamp rather than "Invalid Date"', () => {
    expect(getTimeAgo('not a date')).toBe('');
  });
});
