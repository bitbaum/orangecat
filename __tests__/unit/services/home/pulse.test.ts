/**
 * The home hero says "N studio products live"; a few screens down the LIVE NOW
 * grid lists them. On production the hero said 16 over a grid of 15: the
 * number was Loki's `summary.live`, which counts every live project in the map
 * — a client's portfolio site included — while the grid shows only the
 * studio's own products (`selectHomeFleet`). The number must count exactly
 * what the grid shows, so it is taken from the same selection.
 */

import { selectHomeFleet } from '@/components/ecosystem/studio-fleet';
import type { StudioMapProject, StudioMapSummary } from '@/services/ai/studio-map-fetcher';

const fetchStudioMapForCat = vi.fn<() => Promise<StudioMapSummary | null>>();
vi.mock('@/services/ai/studio-map-fetcher', () => ({
  fetchStudioMapForCat: () => fetchStudioMapForCat(),
}));

vi.mock('@/services/search/discoverCounts', () => ({
  fetchDiscoverCounts: vi.fn(async () => ({
    totalProjectsCount: 14,
    totalProfilesCount: 16,
    totalProductsCount: 3,
    totalServicesCount: 2,
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getHomePulse, resetHomePulseCache } from '@/services/home/pulse';

function project(overrides: Partial<StudioMapProject> & { slug: string }): StudioMapProject {
  return {
    name: overrides.slug,
    what: 'Does a thing',
    layer: 'product',
    status: 'live',
    owner: 'bitbaum',
    urls: { live: null, repo: null, orangecat: null, solon: null },
    next: null,
    now: { openRuns: 0, lastRun: null, lastLog: null },
    ...overrides,
  } as StudioMapProject;
}

/** The shape production served: Loki's summary counts the live client site too. */
function liveMap(): StudioMapSummary {
  const projects = [
    project({ slug: 'orangecat', layer: 'economic' }),
    project({ slug: 'loki', layer: 'execution' }),
    project({ slug: 'solon', layer: 'governance' }),
    project({ slug: 'kivvi', layer: 'product' }),
    project({ slug: 'client-portfolio', layer: 'client' }),
    project({ slug: 'demo-site', layer: 'demo' }),
    project({ slug: 'prospect', layer: 'next', status: 'prospect' }),
  ];
  return {
    generatedAt: '2026-11-12T00:00:00.000Z',
    thesis: '',
    pillars: [],
    summary: { projects: projects.length, live: 6, clients: 1, inFlight: 1 },
    projects,
  };
}

beforeEach(() => {
  resetHomePulseCache();
  fetchStudioMapForCat.mockReset();
});

describe('getHomePulse — studio products live', () => {
  it('counts exactly the tiles the LIVE NOW grid shows, not every live project in the map', async () => {
    const map = liveMap();
    fetchStudioMapForCat.mockResolvedValue(map);

    const pulse = await getHomePulse(0);

    expect(pulse.studioLive).toBe(selectHomeFleet(map).length);
    expect(pulse.studioLive).toBe(4);
    expect(pulse.studioLive).not.toBe(map.summary.live);
  });

  it('is null when the map cannot be reached, so the hero leaves the number out', async () => {
    fetchStudioMapForCat.mockResolvedValue(null);

    const pulse = await getHomePulse(0);

    expect(pulse.studioLive).toBeNull();
    expect(pulse.projects).toBe(14);
  });
});
