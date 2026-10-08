/**
 * The investor portal's generated evidence (docs/features/investor-portal.md):
 * it must say only what its sources say, and admit when a source is capped.
 */
import { findInMap, readFleetProject } from '@/domain/projectRooms/evidence/loki';
import {
  bucketWeeks,
  repoSlug,
  sinceCreated,
  PACE_WEEKS,
} from '@/domain/projectRooms/evidence/github';
import { deriveFacts, shippedRecently } from '@/domain/projectRooms/evidence';
import { sectionAnchor } from '@/components/room/RoomView';

const NOW = Date.parse('2026-10-08T12:00:00Z'); // a Thursday

const RAW = {
  name: 'Heidi',
  status: 'live',
  since: '2026-09-10',
  urls: {
    live: 'https://heidi.orangecat.ch',
    repo: 'https://github.com/bitbaum/heidi',
    orangecat: 'https://orangecat.ch/projects/01affb7e-b5f6-45d8-a9a4-20bff670d013',
  },
  identity: {
    problem: 'The trap.',
    solution: 'Exposure that does not withdraw.',
    mission: '',
    vision: null,
  },
  roadmap: [
    { title: 'Lexicon', line: 'Checks meanings.', status: 'in progress' },
    { title: 'Solon', line: null, status: 'planned' },
    { title: 'Listening lab', status: 'later' },
    { title: 'Bad', status: 'someday' },
    { title: 'Shipped thing', status: 'done' },
  ],
  changelog: [
    { date: '2026-09-01', done: 'Old.' },
    { date: '2026-10-08', done: 'Newest.' },
    { date: '2026-09-20', done: 'Middle.' },
    { date: 'yesterday', done: 'No date.' },
  ],
  records: { source: { roadmap: 'https://x/ROADMAP.md', changelog: 'https://x/CHANGELOG.md' } },
};

describe('Loki fleet map', () => {
  it('finds a project by its OrangeCat link, not by name', () => {
    const map = { projects: [{ urls: { orangecat: 'https://orangecat.ch/projects/other' } }, RAW] };
    expect(findInMap(map, '01affb7e-b5f6-45d8-a9a4-20bff670d013')).toBe(RAW);
    expect(findInMap(map, 'b5f6-45d8-a9a4-20bff670d013')).toBeNull();
    expect(findInMap(null, 'x')).toBeNull();
  });

  it('keeps only well-formed roadmap and changelog entries, newest change first', () => {
    const fleet = readFleetProject(RAW);
    expect(fleet.roadmap.map(r => r.title)).toEqual([
      'Lexicon',
      'Solon',
      'Listening lab',
      'Shipped thing',
    ]);
    expect(fleet.changelog.map(c => c.date)).toEqual(['2026-10-08', '2026-09-20', '2026-09-01']);
    expect(fleet.identity).toEqual({
      problem: 'The trap.',
      solution: 'Exposure that does not withdraw.',
      mission: null,
      vision: null,
    });
  });
});

describe('GitHub pace', () => {
  it('reads owner/repo from a GitHub URL only', () => {
    expect(repoSlug('https://github.com/bitbaum/heidi')).toBe('bitbaum/heidi');
    expect(repoSlug('https://github.com/bitbaum/heidi.git')).toBe('bitbaum/heidi');
    expect(repoSlug('https://gitlab.com/bitbaum/heidi')).toBeNull();
    expect(repoSlug('https://github.com/bitbaum')).toBeNull();
    expect(repoSlug(null)).toBeNull();
  });

  it('buckets commits into Monday-starting weeks ending this week', () => {
    const weeks = bucketWeeks(
      [
        '2026-10-08T09:00:00Z',
        '2026-10-05T00:00:00Z',
        '2026-10-04T23:59:59Z',
        '2026-01-01T00:00:00Z',
        'nonsense',
      ],
      NOW
    );
    expect(weeks).toHaveLength(PACE_WEEKS);
    expect(weeks[PACE_WEEKS - 1]).toEqual({ start: '2026-10-05', count: 2 });
    expect(weeks[PACE_WEEKS - 2]).toEqual({ start: '2026-09-28', count: 1 });
    expect(weeks.reduce((s, w) => s + w.count, 0)).toBe(3);
  });
});

describe('a young repository', () => {
  it('starts its chart the week it was created, and says so in the fact', () => {
    const weeks = sinceCreated(bucketWeeks(['2026-10-01T00:00:00Z'], NOW), '2026-09-10T18:45:45Z');
    expect(weeks[0].start).toBe('2026-09-07'); // the Monday of Thu 10 Sep
    expect(weeks).toHaveLength(5);
    const pace = {
      repoUrl: 'https://github.com/x/y',
      weeks,
      total: 1,
      capped: false,
      createdAt: null,
      license: null,
    };
    expect(deriveFacts(null, pace, NOW)[0].label).toBe('Merged to main, since it started');
    expect(sinceCreated(weeks, null)).toBe(weeks);
  });
});

describe('key facts', () => {
  const fleet = readFleetProject(RAW);

  it('counts what shipped in 30 days, and says "+" only when the map may hide more', () => {
    expect(shippedRecently(fleet, NOW)).toEqual({ count: 2, floor: false });
    const capped = {
      ...fleet,
      changelog: Array.from({ length: 20 }, () => ({ date: '2026-10-01', done: 'x' })),
    };
    expect(shippedRecently(capped, NOW)).toEqual({ count: 20, floor: true });
  });

  it('derives each fact with its source, and nothing from a missing source', () => {
    const pace = {
      repoUrl: 'https://github.com/bitbaum/heidi',
      weeks: bucketWeeks([], NOW),
      total: 212,
      capped: false,
      createdAt: '2026-09-10T18:45:45Z',
      license: 'MIT',
    };
    const facts = deriveFacts(fleet, pace, NOW);
    expect(facts.map(f => [f.label, f.value])).toEqual([
      ['Live since', 'Sep 10, 2026'],
      ['Shipped, last 30 days', '2 changes'],
      ['Merged to main, 12 weeks', '212'],
      ['Roadmap', '1 now · 1 next'],
    ]);
    expect(facts[3].source).toBe('1 done · 1 later');
    // A roadmap with nothing marked done does not say "0 done": finished work
    // often moves to the changelog, and "0 done" would read as nothing delivered.
    const undone = { ...fleet, roadmap: fleet.roadmap.filter(r => r.status !== 'done') };
    expect(deriveFacts(undone, null, NOW).find(f => f.label === 'Roadmap')?.source).toBe('1 later');
    expect(facts[0].source).toBe('28 days ago');
    expect(facts[2].source).toContain('MIT');
    expect(deriveFacts(null, null, NOW)).toEqual([]);
  });
});

describe('section anchors', () => {
  it('are stable and URL-safe', () => {
    expect(sectionAnchor('The part that is not about Swiss German')).toBe(
      's-the-part-that-is-not-about-swiss-german'
    );
    expect(sectionAnchor('Two kinds of customer, one product')).toBe(
      's-two-kinds-of-customer-one-product'
    );
  });
});
