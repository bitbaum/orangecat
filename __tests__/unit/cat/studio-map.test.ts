import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderStudioMap } from '@/services/ai/context-sections';
import {
  fetchStudioMapForCat,
  resetStudioMapCache,
  studioMapUrl,
  type StudioMapSummary,
} from '@/services/ai/studio-map-fetcher';

vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const map: StudioMapSummary = {
  generatedAt: '2026-09-14T01:00:00.000Z',
  thesis: 'One person plus Bitcoin, an AI fleet and cryptographic governance.',
  pillars: [
    { slug: 'orangecat', layer: 'economic', role: 'Move value.' },
    { slug: 'loki', layer: 'capability', role: 'Get work built.' },
  ],
  summary: { projects: 3, live: 2, clients: 1, inFlight: 1 },
  projects: [
    {
      slug: 'loki',
      name: 'Loki',
      what: 'A captain over a fleet of agents',
      layer: 'capability',
      status: 'live',
      owner: 'bitbaum',
      urls: {
        live: 'https://loki.orangecat.ch',
        repo: 'https://github.com/bitbaum/loki',
        orangecat: 'https://orangecat.ch/projects/oc-1',
        solon: null,
      },
      next: 'Close the chat loop',
      now: {
        openRuns: 1,
        lastRun: { outcome: 'success', at: '2026-09-13T22:00:00Z' },
        lastLog: { date: '2026-09-13', done: 'Renamed the product' },
      },
    },
    {
      slug: 'kivvi',
      name: 'Kivvi',
      what: 'Nanny booking',
      layer: 'client',
      status: 'live',
      owner: 'kivvi',
      urls: { live: 'https://kivvi.orangecat.ch', repo: null, orangecat: null, solon: null },
      next: null,
      now: { openRuns: 0, lastRun: null, lastLog: null },
    },
    {
      slug: 'townsism',
      name: 'Townsism',
      what: null,
      layer: 'next',
      status: 'not live',
      owner: 'bitbaum',
      urls: { live: null, repo: null, orangecat: null, solon: null },
      next: null,
      now: { openRuns: 0, lastRun: null, lastLog: null },
    },
  ],
};

describe('renderStudioMap', () => {
  it('renders nothing when the map is absent or empty', () => {
    expect(renderStudioMap(undefined)).toBeNull();
    expect(renderStudioMap(null)).toBeNull();
    expect(renderStudioMap({ ...map, projects: [] })).toBeNull();
  });

  it('names every project once with purpose, layer, state, doors and movement', () => {
    const s = renderStudioMap(map)!;
    expect(s).toMatch(/^## The studio \(bitbaum\)/);
    expect(s).toContain('3 projects, 2 live, 1 for clients, 1 run in flight.');
    expect(s).toContain('Thesis: One person plus Bitcoin');
    expect(s).toContain('- **orangecat** (economic layer): Move value.');
    expect(s).toContain(
      '- **Loki** (loki) — A captain over a fleet of agents [capability, live; https://loki.orangecat.ch; on OrangeCat https://orangecat.ch/projects/oc-1; 1 run in flight; last: 2026-09-13 Renamed the product; next: Close the chat loop]'
    );
    expect(s).toContain(
      '- **Kivvi** (kivvi) — Nanny booking [client, live, for kivvi; https://kivvi.orangecat.ch]'
    );
    expect(s).toContain('- **Townsism** (townsism) [next, not live]');
    expect(s.split('**Loki**').length).toBe(2);
  });
});

describe('fetchStudioMapForCat', () => {
  beforeEach(() => resetStudioMapCache());

  it('reads the map from Loki and caches it', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(map), { status: 200 }));
    const a = await fetchStudioMapForCat(fetchImpl as unknown as typeof fetch, 1_000);
    const b = await fetchStudioMapForCat(fetchImpl as unknown as typeof fetch, 2_000);
    expect(a?.projects.length).toBe(3);
    expect(b).toBe(a);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(studioMapUrl());
  });

  it('is null, not a throw, when Loki is down — and does not hammer it', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await fetchStudioMapForCat(fetchImpl as unknown as typeof fetch, 1_000)).toBeNull();
    expect(await fetchStudioMapForCat(fetchImpl as unknown as typeof fetch, 2_000)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a body that is not a map', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ rows: [] }), { status: 200 })
    );
    expect(await fetchStudioMapForCat(fetchImpl as unknown as typeof fetch, 1_000)).toBeNull();
  });
});
