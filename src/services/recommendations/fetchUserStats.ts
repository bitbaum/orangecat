/**
 * Fetch User Stats for Recommendations
 *
 * Encapsulates all parallel DB queries and result processing that feed
 * buildUserContext. Extracted from /api/users/me/stats to keep the route thin.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ENTITY_REGISTRY,
  ENTITY_TYPES,
  getTableName,
  type EntityType,
} from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { DATABASE_TABLES, OWN_PROFILE_VIEW } from '@/config/database-tables';
import { getUserActorId } from '@/domain/actors';
import type { AnySupabaseClient } from '@/lib/supabase/types';

type UntypedTable = any;

interface ProfileRecord {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  bitcoin_address: string | null;
  lightning_address: string | null;
  website: string | null;
  location: string | null;
  preferred_currency: string | null;
}

interface UserStatsData {
  profile: ProfileRecord;
  entityCounts: Partial<Record<EntityType, number>>;
  hasWallet: boolean;
  daysSinceLastActivity: number | null;
  hasPublishedEntities: boolean;
  wishlistItemCount: number;
}

/** Fetch profile + actor then all parallel stats for a user. */
export async function fetchUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStatsData | null> {
  const [profileResult, actorResult] = await Promise.all([
    // The owner-scoped view: this runs as `authenticated` via /api/users/me/stats
    // and `select('*')` on the table would now hit the revoked private columns
    // (20260917163100). `userId` is always the session user here, and the view
    // is confined to auth.uid() anyway, so the filter is redundant but harmless.
    (supabase.from(OWN_PROFILE_VIEW) as UntypedTable).select('*').eq('id', userId).single(),
    getUserActorId(supabase as unknown as AnySupabaseClient, userId),
  ]);

  const profile = profileResult.data as ProfileRecord | null;
  if (profileResult.error || !profile) {
    return null;
  }

  // actorResult is now the id itself — getUserActorId returns string | null.
  const actorId = actorResult ?? undefined;

  // Parallel entity counts for all registered types (except wallet)
  const entityCountPromises = ENTITY_TYPES.filter(type => type !== 'wallet').map(
    async (entityType: EntityType) => {
      const meta = ENTITY_REGISTRY[entityType];
      try {
        let query = (supabase.from(meta.tableName) as UntypedTable).select('id', {
          count: 'exact',
          head: true,
        });
        if (meta.userIdField === 'actor_id' && actorId) {
          query = query.eq('actor_id', actorId);
        } else if (meta.userIdField !== 'actor_id') {
          query = query.eq(meta.userIdField, userId);
        }
        const { count, error } = await query;
        return { entityType, count: error ? 0 : count || 0 };
      } catch {
        return { entityType, count: 0 };
      }
    }
  );

  const walletCountPromise = (supabase.from(DATABASE_TABLES.WALLETS) as UntypedTable)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const wishlistItemsPromise = actorId
    ? (supabase.from(DATABASE_TABLES.WISHLIST_ITEMS) as UntypedTable)
        .select('id, wishlists!inner(actor_id)', { count: 'exact', head: true })
        .eq('wishlists.actor_id', actorId)
    : Promise.resolve({ count: 0 });

  const recentProjectPromise = actorId
    ? (supabase.from(getTableName('project')) as UntypedTable)
        .select('updated_at')
        .eq('actor_id', actorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
    : Promise.resolve({ data: null });

  const publishedCountPromise = actorId
    ? (supabase.from(getTableName('project')) as UntypedTable)
        .select('id', { count: 'exact', head: true })
        .eq('actor_id', actorId)
        .eq('status', STATUS.PROJECTS.ACTIVE)
    : Promise.resolve({ count: 0 });

  const [
    entityCountResults,
    walletResult,
    wishlistItemsResult,
    recentProjectResult,
    publishedResult,
  ] = await Promise.all([
    Promise.all(entityCountPromises),
    walletCountPromise,
    wishlistItemsPromise,
    recentProjectPromise,
    publishedCountPromise,
  ]);

  // Aggregate entity counts
  const entityCounts: Partial<Record<EntityType, number>> = {};
  for (const { entityType, count } of entityCountResults) {
    entityCounts[entityType] = count;
  }

  const hasWallet =
    (walletResult.count ?? 0) > 0 || !!profile.bitcoin_address || !!profile.lightning_address;
  const wishlistItemCount = wishlistItemsResult.count || 0;
  const hasPublishedEntities = (publishedResult.count ?? 0) > 0;

  let daysSinceLastActivity: number | null = null;
  const recentProject = recentProjectResult.data as { updated_at: string } | null;
  if (recentProject?.updated_at) {
    const ms = Date.now() - new Date(recentProject.updated_at).getTime();
    daysSinceLastActivity = Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  return {
    profile,
    entityCounts,
    hasWallet,
    daysSinceLastActivity,
    hasPublishedEntities,
    wishlistItemCount,
  };
}
