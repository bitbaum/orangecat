import {
  developmentProfileFromMap,
  loadDevelopmentProfile,
  type DevelopmentProfile,
} from 'bip-kit';

/**
 * Public development records — roadmap and changelog — are a projection of
 * the fleet map, never a local copy. The record itself is `ROADMAP.md` and
 * `CHANGELOG.md` at this repository's root; Loki's map ingests them and the
 * /roadmap and /changelog pages render what the map holds. The pages used to
 * read `src/config/public-content.ts` and `src/config/changelog.ts`, which
 * was the second copy `docs/architecture/building-in-public-ssot.md` says
 * never to keep.
 */
export const FLEET_MAP_URL = 'https://loki.orangecat.ch/api/fleet/map';
export const FLEET_SLUG = 'orangecat';
export const FLEET_PROFILE_URL = `https://loki.orangecat.ch/fleet/${FLEET_SLUG}`;

/** The map is cached five minutes upstream; revalidating faster buys nothing. */
const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 8_000;

/**
 * bip-kit's loader passes `cache: 'no-store'`, which Next refuses alongside
 * `next.revalidate`. Drop it and let the data cache hold the map for five
 * minutes; keep the 8s ceiling so a slow map degrades to "unavailable"
 * rather than holding the page render.
 */
const fleetFetcher: typeof fetch = (input, init) => {
  const { cache: _cache, signal, ...rest } = init ?? {};
  return fetch(input, {
    ...rest,
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
  });
};

export function loadOrangeCatProfile(): Promise<DevelopmentProfile | null> {
  return loadDevelopmentProfile(FLEET_MAP_URL, FLEET_SLUG, fleetFetcher);
}

/** Pure projection of a fetched map for tests and for the pages. */
export function orangeCatProfileFromMap(map: unknown): DevelopmentProfile | null {
  return developmentProfileFromMap(map, FLEET_SLUG);
}

export type RoadmapItem = DevelopmentProfile['roadmap'][number];
export type ChangelogEntry = DevelopmentProfile['changelog'][number];

export interface RoadmapBucket {
  /** Bucket heading as shown; mirrors ROADMAP.md's `##` titles. */
  title: string;
  /** Status string the map carries; used as the key. */
  status: string;
  items: RoadmapItem[];
}

/**
 * The map derives status from ROADMAP.md's bucket titles (`now` → in
 * progress, `next` → planned, `later` → later, `shipped` → done). Rows Loki's
 * own goals table produces say `active`; those read as in progress too.
 * Anything else is shown under its own status, verbatim, rather than dropped.
 */
const KNOWN_BUCKETS: { title: string; matches: string[] }[] = [
  { title: 'Now', matches: ['in progress', 'active', 'doing'] },
  { title: 'Next', matches: ['planned', 'next', 'soon'] },
  { title: 'Later', matches: ['later', 'someday', 'future'] },
  { title: 'Shipped', matches: ['done', 'shipped', 'delivered'] },
];

export function groupRoadmap(items: readonly RoadmapItem[]): RoadmapBucket[] {
  const buckets = KNOWN_BUCKETS.map(b => ({
    title: b.title,
    status: b.matches[0],
    items: [] as RoadmapItem[],
  }));
  const other = new Map<string, RoadmapBucket>();
  for (const item of items) {
    const status = (item.status ?? '').trim().toLowerCase();
    const known = KNOWN_BUCKETS.findIndex(b => b.matches.includes(status));
    if (known >= 0) {
      buckets[known].items.push(item);
      continue;
    }
    const key = status || 'unsorted';
    const bucket = other.get(key) ?? { title: capitalize(key), status: key, items: [] };
    bucket.items.push(item);
    other.set(key, bucket);
  }
  return [...buckets, ...other.values()].filter(b => b.items.length > 0);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function milestoneParts(m: RoadmapItem['milestones'][number]): {
  title: string;
  done: boolean | null;
} {
  return typeof m === 'string' ? { title: m, done: null } : { title: m.title, done: m.done };
}

/** Newest first, stable for entries sharing a date. */
export function sortChangelog(entries: readonly ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * The map joins an entry's bullets with newlines. Split them back into lines
 * so the page can render one bullet per shipped thing.
 */
export function changelogLines(entry: ChangelogEntry): string[] {
  return entry.done
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}
