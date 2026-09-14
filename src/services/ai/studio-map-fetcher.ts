import { logger } from '@/utils/logger';

/**
 * The studio map — every bitbaum project with its purpose, layer, state,
 * doors and what last moved on it — as Loki publishes it.
 *
 * Loki is the one place that joins the hosting register, the project
 * profiles and the run ledger, so Cat reads the map from there rather than
 * keeping a second list of "our products" here (ecosystem.ts stays the SSOT
 * for the three pillars only). Public endpoint, no token; cached in-process
 * for a few minutes because Cat assembles context on every turn.
 *
 * Failure is null, never a throw: Cat without the map is Cat as it was.
 */

export interface StudioMapProject {
  slug: string;
  name: string;
  what: string | null;
  layer: string;
  status: string;
  owner: string;
  urls: {
    live: string | null;
    repo: string | null;
    orangecat: string | null;
    solon: string | null;
  };
  next: string | null;
  now: {
    openRuns: number;
    lastRun: { outcome: string; at: string } | null;
    lastLog: { date: string; done: string } | null;
  };
}

export interface StudioMapSummary {
  generatedAt: string;
  thesis: string;
  pillars: Array<{ slug: string; layer: string; role: string }>;
  summary: { projects: number; live: number; clients: number; inFlight: number };
  projects: StudioMapProject[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

let cached: { at: number; map: StudioMapSummary | null } | null = null;

/** Where Loki publishes the map. Overridable like the other Loki endpoints. */
const STUDIO_MAP_URL = process.env.LOKI_MAP_URL || 'https://loki.orangecat.ch/api/fleet/map';

export function studioMapUrl(): string {
  return STUDIO_MAP_URL;
}

function isMap(v: unknown): v is StudioMapSummary {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const m = v as Record<string, unknown>;
  return Array.isArray(m.projects) && typeof m.generatedAt === 'string';
}

export async function fetchStudioMapForCat(
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now()
): Promise<StudioMapSummary | null> {
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.map;
  }
  let map: StudioMapSummary | null = null;
  try {
    const res = await fetchImpl(studioMapUrl(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (res.ok) {
      const json: unknown = await res.json();
      if (isMap(json)) {
        map = json;
      }
    } else {
      logger.warn('studio map answered non-2xx', { status: res.status });
    }
  } catch (e) {
    logger.warn('studio map unreachable', { error: e instanceof Error ? e.message : String(e) });
  }
  cached = { at: now, map };
  return map;
}

/** Test seam: forget the cached map. */
export function resetStudioMapCache(): void {
  cached = null;
}
