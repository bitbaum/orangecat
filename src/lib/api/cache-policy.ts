/**
 * How long a response may be reused — the SSOT for CDN cache policy.
 *
 * Its own module rather than a corner of standardResponse.ts, for two reasons.
 * A cache policy is configuration, not response construction. And several
 * suites mock `@/lib/api/standardResponse` wholesale, so anything else that
 * imported the presets from there broke the moment a test replaced that module
 * with a stub — a 500 from `CACHE_PRESETS.SHORT` on undefined.
 *
 * Name a preset; do not retype the seconds. The policies below were spelled out
 * by hand in five places, and one of them existed in two spellings that
 * disagreed on the `public,` prefix, which decides whether a shared cache will
 * store a response to an authenticated request at all.
 *
 * A route with a genuinely distinct policy (/api/health at 10s) may define its
 * own — that is one definition, not a duplicate. Add an entry here only when
 * the same seconds want to live in two places.
 */
export const CACHE_PRESETS = {
  // No caching - always fresh
  NONE: 'no-store, must-revalidate',

  // Short cache - 1 minute CDN, 5 minutes stale-while-revalidate
  SHORT: 's-maxage=60, stale-while-revalidate=300',

  // Medium cache - 5 minutes CDN, 30 minutes stale-while-revalidate
  MEDIUM: 's-maxage=300, stale-while-revalidate=1800',

  // Long cache - 1 hour CDN, 24 hours stale-while-revalidate
  LONG: 's-maxage=3600, stale-while-revalidate=86400',

  // Static - 1 day CDN, 1 week stale-while-revalidate
  STATIC: 's-maxage=86400, stale-while-revalidate=604800',
} as const;
