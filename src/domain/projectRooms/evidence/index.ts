/**
 * The evidence a room can generate instead of asking anyone to type it
 * (docs/features/investor-portal.md, phase 1). Each fact says where it comes
 * from, and links there when it can.
 */

import { APP_LOCALE } from '@/utils/locale';
import { getFleetProject, type FleetProject, type RoadmapStatus } from './loki';
import { getRepoPace, PACE_WEEKS, type RepoPace } from './github';

export type { FleetProject, RepoPace, RoadmapStatus };

export interface RoomFact {
  label: string;
  value: string;
  /** Where it comes from, in words a reader can act on. */
  source: string;
  href?: string;
}

export interface RoomEvidence {
  fleet: FleetProject | null;
  pace: RepoPace | null;
  facts: RoomFact[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Loki's map carries at most this many changelog entries per project. */
const MAP_CHANGELOG_CAP = 20;

function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function roadmapCounts(fleet: FleetProject): Record<RoadmapStatus, number> {
  const counts: Record<RoadmapStatus, number> = { done: 0, 'in progress': 0, planned: 0, later: 0 };
  for (const item of fleet.roadmap) {
    counts[item.status] += 1;
  }
  return counts;
}

/** The changelog entries of the last 30 days, and whether the map's cap may hide more. */
export function shippedRecently(
  fleet: FleetProject,
  now: number
): { count: number; floor: boolean } {
  const cutoff = new Date(now - 30 * DAY_MS).toISOString().slice(0, 10);
  const recent = fleet.changelog.filter(c => c.date >= cutoff);
  const oldest = fleet.changelog.map(c => c.date).sort()[0];
  const floor = fleet.changelog.length >= MAP_CHANGELOG_CAP && !!oldest && oldest >= cutoff;
  return { count: recent.length, floor };
}

/** The key facts at the top of a room. Pure; exported for tests. */
export function deriveFacts(
  fleet: FleetProject | null,
  pace: RepoPace | null,
  now: number
): RoomFact[] {
  const facts: RoomFact[] = [];

  if (fleet?.since) {
    const days = Math.max(0, Math.floor((now - Date.parse(`${fleet.since}T00:00:00Z`)) / DAY_MS));
    facts.push({
      label: fleet.status === 'live' ? 'Live since' : 'Started',
      value: longDate(fleet.since),
      source: `${days} days ago`,
      href: fleet.urls.live ?? undefined,
    });
  }

  if (fleet && fleet.changelog.length > 0) {
    const { count, floor } = shippedRecently(fleet, now);
    facts.push({
      label: 'Shipped, last 30 days',
      value: `${count}${floor ? '+' : ''} ${count === 1 ? 'change' : 'changes'}`,
      source: 'Public changelog',
      href: fleet.sources.changelog ?? undefined,
    });
  }

  if (pace) {
    facts.push({
      label:
        pace.weeks.length < PACE_WEEKS
          ? 'Merged to main, since it started'
          : `Merged to main, ${PACE_WEEKS} weeks`,
      value: `${pace.total}${pace.capped ? '+' : ''}`,
      source: pace.license ? `Open source (${pace.license}) — GitHub` : 'GitHub',
      href: pace.repoUrl,
    });
  }

  if (fleet && fleet.roadmap.length > 0) {
    // Led by what is moving. Many products move finished items from the
    // roadmap to the changelog, so "0 done" would read as nothing delivered
    // when the changelog above says otherwise — done is named only when counted.
    const c = roadmapCounts(fleet);
    facts.push({
      label: 'Roadmap',
      value: `${c['in progress']} now · ${c.planned} next`,
      source: c.done > 0 ? `${c.done} done · ${c.later} later` : `${c.later} later`,
      href: fleet.sources.roadmap ?? undefined,
    });
  }

  return facts;
}

export async function getRoomEvidence(
  projectId: string,
  now: number = Date.now()
): Promise<RoomEvidence> {
  const fleet = await getFleetProject(projectId);
  const pace = await getRepoPace(fleet?.urls.repo ?? null, now);
  return { fleet, pace, facts: deriveFacts(fleet, pace, now) };
}
