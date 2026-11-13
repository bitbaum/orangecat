import { describe, expect, it } from 'vitest';
import { groupChangelog, splitLead } from '@/lib/development/changelog-view';

describe('splitLead', () => {
  it('takes the first sentence as the headline', () => {
    expect(
      splitLead('Your tasks are yours. A task is seen by the person who made it. Before, all.')
    ).toEqual({
      lead: 'Your tasks are yours.',
      rest: 'A task is seen by the person who made it. Before, all.',
    });
  });

  it('keeps a one-sentence line whole', () => {
    expect(splitLead('Nothing disappears in dark mode.')).toEqual({
      lead: 'Nothing disappears in dark mode.',
      rest: '',
    });
  });
});

describe('groupChangelog', () => {
  const day = (date: string, n = 1) => ({ date, lines: Array.from({ length: n }, () => ({})) });

  it('keeps the last 30 days open and folds older days per month, newest first', () => {
    const days = [
      day('2026-11-12', 2),
      day('2026-10-20'),
      day('2026-10-10', 3),
      day('2026-10-01'),
      day('2026-09-15'),
    ];
    const { recent, months } = groupChangelog(days);
    expect(recent.map(d => d.date)).toEqual(['2026-11-12', '2026-10-20']);
    expect(months.map(m => [m.key, m.label, m.lineCount])).toEqual([
      ['2026-10', 'October 2026', 4],
      ['2026-09', 'September 2026', 1],
    ]);
  });

  it('returns nothing for an empty record', () => {
    expect(groupChangelog([])).toEqual({ recent: [], months: [] });
  });
});
