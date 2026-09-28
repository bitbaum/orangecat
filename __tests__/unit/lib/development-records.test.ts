/**
 * /roadmap and /changelog render the fleet map, never a local copy. This
 * covers the data path between a fetched map and what the pages draw, on a
 * fixture — no network — so the pages' contract with bip-kit is pinned:
 * bucket titles from ROADMAP.md statuses, newest-first changelog, and the
 * two degraded states (map unavailable, project recorded but empty).
 */
import { describe, expect, it } from 'vitest';
import {
  changelogLines,
  groupRoadmap,
  milestoneParts,
  orangeCatProfileFromMap,
  sortChangelog,
} from '@/lib/development/records';

const MAP = {
  generatedAt: '2026-09-28T10:59:21.707Z',
  projects: [
    { slug: 'loki', name: 'loki', roadmap: [], changelog: [] },
    {
      slug: 'orangecat',
      name: 'orangecat',
      what: 'Economic layer',
      roadmap: [
        {
          title: 'Fund-to-build',
          status: 'planned',
          progress: 25,
          targetDate: null,
          milestones: [
            { title: 'Signed handoff to Loki', done: true },
            { title: 'Funding summary inside Loki', done: false },
          ],
        },
        {
          title: 'Share and fund anything',
          status: 'in progress',
          progress: 40,
          targetDate: null,
          milestones: ['One Support with Bitcoin action'],
        },
        { title: 'Launch OrangeCat', status: 'active', progress: 100, milestones: [] },
        { title: 'More rails', status: 'later', progress: null, milestones: [] },
        { title: 'Public pages for every entity', status: 'done', progress: 100, milestones: [] },
        { title: 'Odd one', status: 'parked', progress: null, milestones: [] },
      ],
      changelog: [
        { date: '2026-09-20', done: 'Prices are real; the checkout is deliberately shut.' },
        {
          date: '2026-09-28',
          done: 'New essay: Where the Wall Is.\nRoadmap and changelog now come from the fleet record.',
        },
      ],
    },
  ],
};

describe('development records from the fleet map', () => {
  it('projects the orangecat entry and nothing else', () => {
    const profile = orangeCatProfileFromMap(MAP);
    expect(profile?.slug).toBe('orangecat');
    expect(profile?.roadmap).toHaveLength(6);
    expect(profile?.changelog).toHaveLength(2);
  });

  it('is null when the map is unavailable or malformed', () => {
    expect(orangeCatProfileFromMap(null)).toBeNull();
    expect(orangeCatProfileFromMap({ projects: 'nope' })).toBeNull();
    expect(orangeCatProfileFromMap({ projects: [{ slug: 'loki' }] })).toBeNull();
  });

  it('keeps an empty record distinct from an unavailable one', () => {
    const profile = orangeCatProfileFromMap({
      projects: [{ slug: 'orangecat', name: 'orangecat', roadmap: [], changelog: [] }],
    });
    expect(profile).not.toBeNull();
    expect(profile?.roadmap).toEqual([]);
    expect(groupRoadmap(profile!.roadmap)).toEqual([]);
  });

  it('buckets items by the status ROADMAP.md headings produce, in Now/Next/Later/Shipped order', () => {
    const buckets = groupRoadmap(orangeCatProfileFromMap(MAP)!.roadmap);
    expect(buckets.map(b => b.title)).toEqual(['Now', 'Next', 'Later', 'Shipped', 'Parked']);
    // Loki's own goal rows say `active`; they read as in progress, not as a stray bucket.
    expect(buckets[0].items.map(i => i.title)).toEqual([
      'Share and fund anything',
      'Launch OrangeCat',
    ]);
    expect(buckets[1].items[0].title).toBe('Fund-to-build');
    expect(buckets[4].items[0].title).toBe('Odd one');
  });

  it('reads both milestone shapes the map carries', () => {
    expect(milestoneParts('legacy row')).toEqual({ title: 'legacy row', done: null });
    expect(milestoneParts({ title: 'checked', done: true })).toEqual({
      title: 'checked',
      done: true,
    });
  });

  it('orders the changelog newest first and splits joined bullets', () => {
    const entries = sortChangelog(orangeCatProfileFromMap(MAP)!.changelog);
    expect(entries.map(e => e.date)).toEqual(['2026-09-28', '2026-09-20']);
    expect(changelogLines(entries[0])).toEqual([
      'New essay: Where the Wall Is.',
      'Roadmap and changelog now come from the fleet record.',
    ]);
    expect(changelogLines(entries[1])).toHaveLength(1);
  });
});
