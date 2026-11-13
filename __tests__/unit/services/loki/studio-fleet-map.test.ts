/**
 * The map a public page draws tiles from: OrangeCat project links checked
 * against what a signed-out visitor can open.
 */

const LIVE_ID = '8130c927-114a-45b7-8cc2-99efd5224025';
const DEAD_ID = '7a41a97f-e8d1-4565-a11b-4350ddb3a58b';

const fetchMap = vi.fn();
const inFilter = vi.fn();

vi.mock('@/services/ai/studio-map-fetcher', () => ({
  fetchStudioMapForCat: () => fetchMap(),
}));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    from: () => ({ select: () => ({ in: (...args: unknown[]) => inFilter(...args) }) }),
  }),
}));

import { ECOSYSTEM } from '@/config/ecosystem';
import {
  fetchStudioMapForPublicPage,
  resetStudioFleetMapCache,
} from '@/services/loki/studio-fleet-map';

const SITE = ECOSYSTEM.orangeCat.siteUrl.replace(/\/$/, '');

function studioMap() {
  const urls = (id: string, live: string) => ({
    live,
    repo: null,
    orangecat: `${SITE}/projects/${id}`,
    solon: null,
  });
  return {
    generatedAt: '2026-11-13T00:00:00.000Z',
    thesis: '',
    pillars: [],
    summary: { projects: 2, live: 2, clients: 0, inFlight: 0 },
    projects: [
      { slug: 'loki', urls: urls(LIVE_ID, 'https://loki.orangecat.ch') },
      { slug: 'bitbaum', urls: urls(DEAD_ID, 'https://bitbaum.orangecat.ch') },
    ],
  };
}

beforeEach(() => {
  resetStudioFleetMapCache();
  fetchMap.mockReset();
  inFilter.mockReset();
});

describe('fetchStudioMapForPublicPage', () => {
  it('drops the link to a project page nobody can open, keeps the rest', async () => {
    fetchMap.mockResolvedValue(studioMap());
    inFilter.mockResolvedValue({ data: [{ id: LIVE_ID }], error: null });

    const result = await fetchStudioMapForPublicPage();

    expect(inFilter).toHaveBeenCalledWith('id', expect.arrayContaining([LIVE_ID, DEAD_ID]));
    expect(result?.projects.map(p => p.urls.orangecat)).toEqual([
      `${SITE}/projects/${LIVE_ID}`,
      null,
    ]);
  });

  it('checks once per map, not per visitor', async () => {
    const same = studioMap();
    fetchMap.mockResolvedValue(same);
    inFilter.mockResolvedValue({ data: [{ id: LIVE_ID }], error: null });

    await fetchStudioMapForPublicPage();
    await fetchStudioMapForPublicPage();

    expect(inFilter).toHaveBeenCalledTimes(1);
  });

  it('drops every project link when the check fails, rather than trusting them', async () => {
    fetchMap.mockResolvedValue(studioMap());
    inFilter.mockResolvedValue({ data: null, error: { message: 'down' } });

    const result = await fetchStudioMapForPublicPage();

    expect(result?.projects.map(p => p.urls.orangecat)).toEqual([null, null]);
  });

  it('is null when the map is unreachable', async () => {
    fetchMap.mockResolvedValue(null);
    expect(await fetchStudioMapForPublicPage()).toBeNull();
    expect(inFilter).not.toHaveBeenCalled();
  });
});
