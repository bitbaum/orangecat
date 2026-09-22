/**
 * getLokiProjectLink — what a project page may believe about its neighbour.
 *
 * The page offered "Build it with Loki" to owners of projects that had been
 * building in Loki for months, because nothing here could tell the difference.
 * This is what it asks now, and the whole point of the helper is what it does
 * when the answer is unhelpful: Loki is a separate product on a separate
 * deploy, and a slow, broken or absent neighbour must cost this page nothing.
 *
 * Every failure path collapses to `{ linked: false }` — the state the page
 * already knows how to render — so none of them can ever throw into a render.
 */

import { getLokiProjectLink } from '@/services/loki/project-link';

const ID = '01affb7e-b5f6-45d8-a9a4-20bff670d013';
const PROFILE = 'https://loki.orangecat.ch/fleet/heidi';

const json = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body } as unknown as Response);

describe('getLokiProjectLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes through a linked project with its public profile', async () => {
    vi.stubGlobal('fetch', json({ linked: true, name: 'Heidi', profileUrl: PROFILE }));
    expect(await getLokiProjectLink(ID)).toEqual({
      linked: true,
      name: 'Heidi',
      profileUrl: PROFILE,
    });
  });

  it('asks Loki for the id it was given', async () => {
    const fetchMock = json({ linked: false });
    vi.stubGlobal('fetch', fetchMock);
    await getLokiProjectLink(ID);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/orangecat/project-link');
    expect(url.searchParams.get('project_id')).toBe(ID);
  });

  it('treats a linked project with no destination as not linked', async () => {
    // A card whose button goes nowhere is worse than no card. Loki returns a
    // null profileUrl when it cannot derive a slug.
    vi.stubGlobal('fetch', json({ linked: true, name: 'Heidi', profileUrl: null }));
    expect(await getLokiProjectLink(ID)).toEqual({ linked: false });
  });

  it('reports not linked when Loki says so', async () => {
    vi.stubGlobal('fetch', json({ linked: false }));
    expect(await getLokiProjectLink(ID)).toEqual({ linked: false });
  });

  it('reports not linked on an error status', async () => {
    vi.stubGlobal('fetch', json({ error: 'nope' }, false));
    expect(await getLokiProjectLink(ID)).toEqual({ linked: false });
  });

  it('reports not linked when the neighbour is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TimeoutError: signal timed out')));
    expect(await getLokiProjectLink(ID)).toEqual({ linked: false });
  });

  it('reports not linked when the answer is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      } as unknown as Response)
    );
    expect(await getLokiProjectLink(ID)).toEqual({ linked: false });
  });

  it('does not call out at all for an empty id', async () => {
    const fetchMock = json({ linked: true, profileUrl: PROFILE });
    vi.stubGlobal('fetch', fetchMock);
    expect(await getLokiProjectLink('')).toEqual({ linked: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
