/**
 * A "Live now" tile must open a page that exists. Loki's map named a deleted
 * OrangeCat project for Bitbaum and the first tile on the home page was a 404;
 * the link is checked, and a dead one falls back to the product's own site.
 */

import { projectHref, toTile } from '@/components/ecosystem/studio-fleet';
import {
  linkedProjectIds,
  orangeCatProjectId,
  withoutDeadProjectLinks,
} from '@/components/ecosystem/studio-fleet-links';
import { ECOSYSTEM } from '@/config/ecosystem';
import type { StudioMapProject, StudioMapSummary } from '@/services/ai/studio-map-fetcher';

const SITE = ECOSYSTEM.orangeCat.siteUrl.replace(/\/$/, '');
const LIVE_ID = '8130c927-114a-45b7-8cc2-99efd5224025';
const DEAD_ID = '7a41a97f-e8d1-4565-a11b-4350ddb3a58b';

function project(slug: string, orangecat: string | null, live: string | null): StudioMapProject {
  return {
    slug,
    name: slug,
    what: 'Does a thing',
    layer: 'product',
    status: 'live',
    owner: 'bitbaum',
    urls: { live, repo: null, orangecat, solon: null },
    next: null,
    now: { openRuns: 0, lastRun: null, lastLog: null },
  };
}

function map(projects: StudioMapProject[]): StudioMapSummary {
  return {
    generatedAt: '2026-11-13T00:00:00.000Z',
    thesis: '',
    pillars: [],
    summary: { projects: projects.length, live: 0, clients: 0, inFlight: 0 },
    projects,
  };
}

describe('orangeCatProjectId', () => {
  it('reads the id from an OrangeCat project URL', () => {
    expect(orangeCatProjectId(`${SITE}/projects/${LIVE_ID}`)).toBe(LIVE_ID);
    expect(orangeCatProjectId(`${SITE}/projects/${LIVE_ID.toUpperCase()}/`)).toBe(LIVE_ID);
  });

  it('ignores other hosts, other paths and garbage', () => {
    expect(orangeCatProjectId(`https://example.com/projects/${LIVE_ID}`)).toBeNull();
    expect(orangeCatProjectId(`${SITE}/ecosystem`)).toBeNull();
    expect(orangeCatProjectId('not a url')).toBeNull();
    expect(orangeCatProjectId(null)).toBeNull();
  });
});

describe('withoutDeadProjectLinks', () => {
  const fleet = map([
    project('loki', `${SITE}/projects/${LIVE_ID}`, 'https://loki.orangecat.ch'),
    project('bitbaum', `${SITE}/projects/${DEAD_ID}`, 'https://bitbaum.orangecat.ch'),
    project('other', `${SITE}/ecosystem`, null),
  ]);

  it('lists each linked project once', () => {
    expect(linkedProjectIds(fleet).sort()).toEqual([DEAD_ID, LIVE_ID].sort());
  });

  it('sends a tile whose project page is gone to the product’s own site', () => {
    const checked = withoutDeadProjectLinks(fleet, new Set([LIVE_ID]));
    const [loki, bitbaum, other] = checked.projects;

    expect(projectHref(loki)).toEqual({ href: `/projects/${LIVE_ID}`, external: false });
    expect(projectHref(bitbaum)).toEqual({
      href: 'https://bitbaum.orangecat.ch',
      external: true,
    });
    expect(toTile(bitbaum).href).toBe('https://bitbaum.orangecat.ch');
    // Not a project page: nothing to check, left as Loki wrote it.
    expect(other.urls.orangecat).toBe(`${SITE}/ecosystem`);
  });

  it('leaves no link at all rather than a 404 when there is no site either', () => {
    const checked = withoutDeadProjectLinks(
      map([project('ghost', `${SITE}/projects/${DEAD_ID}`, null)]),
      new Set()
    );
    expect(projectHref(checked.projects[0])).toEqual({ href: null, external: false });
  });
});
