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
