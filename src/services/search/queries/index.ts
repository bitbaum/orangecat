/**
 * Search Query Functions — Barrel Re-export
 *
 * All search query functions are split into focused modules by entity type.
 * This barrel file preserves the original import surface so existing consumers
 * (e.g., `from './search/queries'`) continue to work unchanged.
 *
 * Modules:
 *   profiles.ts    — searchProfiles
 *   projects.ts    — searchFundingPages
 *   loans.ts       — searchLoans
 *   suggestions.ts — getSearchSuggestions
 *   trending.ts    — getTrending
 *   helpers.ts     — shared utilities (buildProfileMap, haversineDistance); search terms
 *                    go through lib/db/likePattern
 */

export { searchProfiles } from './profiles';
export { searchFundingPages } from './projects';
export { searchLoans } from './loans';
export { getSearchSuggestions, getGlobalSearchResults } from './suggestions';
export type { GlobalSearchHit } from './suggestions';
export { getTrending } from './trending';
