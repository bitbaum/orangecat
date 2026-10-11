/**
 * The studio's fleet, as the home page and /ecosystem present it.
 *
 * The map is Loki's; these are the rules OrangeCat applies to it before a
 * tile is drawn — which projects the front page shows, in what order, under
 * what name, and where a tile goes. Rules in a pure module so they are
 * tested, not eyeballed on the live site.
 */

import {
  displayName,
  groupFleetByLayer,
  projectHref,
  selectHomeFleet,
  toTile,
} from '@/components/ecosystem/studio-fleet';
import { ECOSYSTEM } from '@/config/ecosystem';
import type { StudioMapProject, StudioMapSummary } from '@/services/ai/studio-map-fetcher';

function project(overrides: Partial<StudioMapProject> & { slug: string }): StudioMapProject {
  return {
    name: overrides.slug,
    what: null,
    layer: 'product',
    status: 'live',
    owner: 'bitbaum',
    urls: { live: null, repo: null, orangecat: null, solon: null },
    next: null,
    now: { openRuns: 0, lastRun: null, lastLog: null },
    ...overrides,
  } as StudioMapProject;
}

function map(projects: StudioMapProject[]): StudioMapSummary {
  return {
    generatedAt: '2026-10-11T00:00:00.000Z',
    thesis: '',
    pillars: [],
    summary: { projects: projects.length, live: 0, clients: 0, inFlight: 0 },
    projects,
  };
}

describe('displayName', () => {
  it('turns a slug into a name', () => {
    expect(displayName({ slug: 'surf-your-life', name: 'surf-your-life' })).toBe('Surf your life');
  });

  it('keeps the product name for a pillar', () => {
    expect(displayName({ slug: 'loki', name: 'loki' })).toBe('Loki');
    expect(displayName({ slug: 'orangecat', name: 'orangecat' })).toBe('OrangeCat');
  });
});

describe('projectHref', () => {
  it('links to the project page here, as a same-origin path', () => {
    const own = `${ECOSYSTEM.orangeCat.siteUrl.replace(/\/$/, '')}/projects/abc`;
    expect(
      projectHref({ urls: { live: 'https://x.example', repo: null, orangecat: own, solon: null } })
    ).toEqual({
      href: '/projects/abc',
      external: false,
    });
  });

  it('falls back to the live site, externally', () => {
    expect(
      projectHref({
        urls: { live: 'https://loki.orangecat.ch', repo: null, orangecat: null, solon: null },
      })
    ).toEqual({ href: 'https://loki.orangecat.ch', external: true });
  });

  it('is null when the project has no door at all', () => {
    expect(projectHref({ urls: { live: null, repo: null, orangecat: null, solon: null } })).toEqual(
      {
        href: null,
        external: false,
      }
    );
  });
});

describe('selectHomeFleet', () => {
  it('shows live studio products only, pillars first, then by name', () => {
    const tiles = selectHomeFleet(
      map([
        project({ slug: 'zeta', layer: 'product' }),
        project({ slug: 'client-site', layer: 'client' }),
        project({ slug: 'demo-site', layer: 'demo' }),
        project({ slug: 'solon', layer: 'governance' }),
        project({ slug: 'alpha', layer: 'product' }),
        project({ slug: 'loki', layer: 'execution' }),
        project({ slug: 'dead', layer: 'product', status: 'not live' }),
        project({ slug: 'orangecat', layer: 'economic' }),
      ])
    );
    expect(tiles.map(t => t.slug)).toEqual(['orangecat', 'loki', 'solon', 'alpha', 'zeta']);
    expect(tiles[0].pillar).toBe('orangecat');
    expect(tiles[3].pillar).toBeNull();
  });

  it('is empty without a map', () => {
    expect(selectHomeFleet(null)).toEqual([]);
  });
});

describe('groupFleetByLayer', () => {
  it('groups every project in stack order', () => {
    const groups = groupFleetByLayer(
      map([
        project({ slug: 'b', layer: 'next', status: 'prospect' }),
        project({ slug: 'a', layer: 'client' }),
        project({ slug: 'loki', layer: 'execution' }),
      ])
    );
    expect(groups.map(g => g.layer)).toEqual(['execution', 'client', 'next']);
  });
});

describe('toTile', () => {
  it('carries when the project last moved', () => {
    const tile = toTile(
      project({
        slug: 'loki',
        now: { openRuns: 0, lastRun: null, lastLog: { date: '2026-10-09', done: 'shipped' } },
      })
    );
    expect(tile.lastMovedOn).toBe('2026-10-09');
  });

  it('keeps the live site even when the tile links to the page here', () => {
    const own = `${ECOSYSTEM.orangeCat.siteUrl.replace(/\/$/, '')}/projects/abc`;
    const tile = toTile(
      project({
        slug: 'loki',
        urls: { live: 'https://loki.orangecat.ch', repo: null, orangecat: own, solon: null },
      })
    );
    expect(tile.href).toBe('/projects/abc');
    expect(tile.liveUrl).toBe('https://loki.orangecat.ch');
    expect(tile.live).toBe(true);
  });
});
