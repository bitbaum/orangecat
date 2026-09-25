/**
 * Public listing counts for a profile — SSOT for "what does this person offer".
 *
 * Used by:
 *  - /profiles/[username] (per-type tab badges)
 *  - entity-detail trust block ("N active listings" on the provider card)
 *
 * Filter shape matches the public profile tabs (PROFILE_HIDDEN_STATUS_FILTER,
 * respect show_on_profile) so the trust-block number always equals what a visitor
 * finds when they click through to the profile. Real counts only — never
 * a placeholder.
 */
import { getTableName, type EntityType } from '@/config/entity-registry';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { PROFILE_HIDDEN_STATUS_FILTER } from '@/config/profile-listing-visibility';

/**
 * Entity types counted on a public profile, with the column that links the
 * row to its owner. `owner_id` for asset vs. `user_id` everywhere else is
 * legacy schema drift, not a convention to copy.
 */
export const PROFILE_LISTING_COUNT_CONFIG: ReadonlyArray<{
  type: EntityType;
  userField: string;
  /** A boolean column that must be true for the row to count as a listing. */
  publicField?: string;
}> = [
  { type: 'project', userField: 'user_id' },
  { type: 'product', userField: 'user_id' },
  { type: 'service', userField: 'user_id' },
  { type: 'cause', userField: 'user_id' },
  { type: 'event', userField: 'user_id' },
  { type: 'loan', userField: 'user_id' },
  { type: 'asset', userField: 'owner_id' },
  // A private companion is the owner's alone, not a listing.
  { type: 'ai_assistant', userField: 'user_id', publicField: 'is_public' },
];

export interface ProfileListingCounts {
  /** Per-entity-type public listing counts. */
  counts: Partial<Record<EntityType, number>>;
  /** Sum across all counted types — the trust block's "N active listings". */
  total: number;
}

/**
 * Count a profile's publicly visible listings, in parallel (head-only count
 * queries — no rows transferred).
 */
export async function fetchProfileListingCounts(
  supabase: AnySupabaseClient,
  profileId: string
): Promise<ProfileListingCounts> {
  const results = await Promise.all(
    PROFILE_LISTING_COUNT_CONFIG.map(({ type, userField, publicField }) => {
      const query = supabase
        .from(getTableName(type))
        .select('*', { count: 'exact', head: true })
        .eq(userField, profileId)
        .not('status', 'in', PROFILE_HIDDEN_STATUS_FILTER)
        .neq('show_on_profile', false);
      return publicField ? query.eq(publicField, true) : query;
    })
  );

  const counts = Object.fromEntries(
    PROFILE_LISTING_COUNT_CONFIG.map(({ type }, i) => [type, results[i].count || 0])
  ) as Partial<Record<EntityType, number>>;

  const total = Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);

  return { counts, total };
}
