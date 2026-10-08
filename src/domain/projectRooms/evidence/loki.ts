/**
 * What Loki's public fleet map says about a project (investor portal, phase 1):
 * its identity, roadmap and changelog — each written in the product's own
 * repository and read by Loki, so the room shows them without anyone retyping.
 *
 * NEVER FAILS THE ROOM. Loki is a neighbour on its own deploy; any failure
 * returns null and the room renders without the section.
 */

import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';

const TIMEOUT_MS = 3_000;
/** Loki caches the map for 5 minutes; asking more often buys nothing. */
const REVALIDATE_SECONDS = 600;

export type RoadmapStatus = 'done' | 'in progress' | 'planned' | 'later';

export interface FleetRoadmapItem {
  title: string;
  line: string | null;
  status: RoadmapStatus;
}

export interface FleetChange {
  date: string;
  done: string;
}

export interface FleetProject {
  name: string;
  status: string | null;
  since: string | null;
  urls: { live: string | null; repo: string | null };
  identity: {
    problem: string | null;
    solution: string | null;
    mission: string | null;
    vision: string | null;
  };
  roadmap: FleetRoadmapItem[];
  changelog: FleetChange[];
  sources: { roadmap: string | null; changelog: string | null };
}

const STATUSES: readonly RoadmapStatus[] = ['done', 'in progress', 'planned', 'later'];

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** One project from the map, shaped and checked. Exported for tests. */
export function readFleetProject(raw: Record<string, unknown>): FleetProject {
  const urls = (raw.urls ?? {}) as Record<string, unknown>;
  const identity = (raw.identity ?? {}) as Record<string, unknown>;
  const records = (raw.records ?? {}) as { source?: Record<string, unknown> };
  const roadmap = Array.isArray(raw.roadmap) ? raw.roadmap : [];
  const changelog = Array.isArray(raw.changelog) ? raw.changelog : [];

  return {
    name: str(raw.name) ?? '',
    status: str(raw.status),
    since: str(raw.since),
    urls: { live: str(urls.live), repo: str(urls.repo) },
    identity: {
      problem: str(identity.problem),
      solution: str(identity.solution),
      mission: str(identity.mission),
      vision: str(identity.vision),
    },
    roadmap: roadmap
      .map(r => r as Record<string, unknown>)
      .filter(r => str(r.title) && STATUSES.includes(r.status as RoadmapStatus))
      .map(r => ({ title: str(r.title)!, line: str(r.line), status: r.status as RoadmapStatus })),
    changelog: changelog
      .map(c => c as Record<string, unknown>)
      .filter(c => /^\d{4}-\d{2}-\d{2}$/.test(String(c.date)) && str(c.done))
      .map(c => ({ date: String(c.date), done: str(c.done)! }))
      // Newest first, whatever order the map sends — the room shows the top few.
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    sources: { roadmap: str(records.source?.roadmap), changelog: str(records.source?.changelog) },
  };
}

/** The map entry whose OrangeCat link is this project. Exported for tests. */
export function findInMap(map: unknown, projectId: string): Record<string, unknown> | null {
  const projects = (map as { projects?: unknown })?.projects;
  if (!Array.isArray(projects)) {
    return null;
  }
  const hit = projects.find(p => {
    const url = (p as { urls?: { orangecat?: unknown } })?.urls?.orangecat;
    return typeof url === 'string' && url.replace(/\/+$/, '').endsWith(`/projects/${projectId}`);
  });
  return (hit as Record<string, unknown> | undefined) ?? null;
}

export async function getFleetProject(projectId: string): Promise<FleetProject | null> {
  try {
    const response = await fetch(new URL(LOKI_ENDPOINTS.fleetMap, ECOSYSTEM.loki.siteUrl), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return null;
    }
    const raw = findInMap(await response.json(), projectId);
    return raw ? readFleetProject(raw) : null;
  } catch {
    return null;
  }
}
