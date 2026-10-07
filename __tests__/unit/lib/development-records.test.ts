/**
 * /roadmap and /changelog render the fleet map, never a local copy. This
 * covers the data path between a fetched map and what the pages draw, on a
 * fixture — no network — so the pages' contract with bip-kit is pinned:
 * phases from ROADMAP.md statuses, newest-first changelog, and the
 * two degraded states (map unavailable, project recorded but empty).
 */
import { describe, expect, it } from 'vitest';
import { linkDevelopment } from 'bip-kit';
import { orangeCatProfileFromMap } from '@/lib/development/records';

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
    expect(linkDevelopment(profile!).goals).toEqual([]);
  });

  it('places each goal on the road by the status ROADMAP.md headings produce', () => {
    const { journey } = linkDevelopment(orangeCatProfileFromMap(MAP)!);
    expect(journey.now.map(g => g.title)).toEqual(['Share and fund anything', 'Launch OrangeCat']);
    expect(journey.next.map(g => g.title)).toEqual(['Fund-to-build', 'Odd one']);
    expect(journey.later.map(g => g.title)).toEqual(['More rails']);
    expect(journey.shipped.map(g => g.title)).toEqual(['Public pages for every entity']);
  });

  it('reads both milestone shapes the map carries', () => {
    const [fund, share] = linkDevelopment(orangeCatProfileFromMap(MAP)!).goals;
    expect(fund.steps.map(s => s.done)).toEqual([true, false]);
    expect(share.steps).toMatchObject([{ title: 'One Support with Bitcoin action', done: null }]);
  });

  it('orders the changelog newest first and splits joined bullets', () => {
    const { changes } = linkDevelopment(orangeCatProfileFromMap(MAP)!);
    expect(changes.map(c => c.date)).toEqual(['2026-09-28', '2026-09-20']);
    expect(changes[0].anchor).toBe('change-2026-09-28');
    expect(changes[0].lines.map(l => l.text)).toEqual([
      'New essay: Where the Wall Is.',
      'Roadmap and changelog now come from the fleet record.',
    ]);
  });
});
