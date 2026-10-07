/**
 * Everything public that an unclaimed placeholder owns — for its profile page.
 *
 * The page used to ask for projects only, because the first thing ever set up
 * for someone was a project. A studio set up for a DJ is an ASSET, and on that
 * page it simply did not exist: the person's address showed their name and
 * nothing that was theirs. The set of types comes from the registry — every
 * type owned by actor — so the next kind of thing set up for someone appears
 * without another edit here.
 */
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { PROFILE_HIDDEN_STATUS_FILTER } from '@/config/profile-listing-visibility';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** Public listing types that can belong to an actor, in page order. */
export const UNCLAIMED_LISTING_TYPES: EntityType[] = (
  ['project', 'asset', 'service', 'product', 'event', 'cause'] as EntityType[]
).filter(type => ENTITY_REGISTRY[type].userIdField === 'actor_id');

export interface UnclaimedListing {
  type: EntityType;
  id: string;
  title: string;
  description: string | null;
  href: string;
}

export async function fetchUnclaimedListings(
  supabase: AnySupabaseClient,
  actorId: string
): Promise<UnclaimedListing[]> {
  const perType = await Promise.all(
    UNCLAIMED_LISTING_TYPES.map(async type => {
      const meta = ENTITY_REGISTRY[type];
      const { data } = await looseClient(supabase)
        .from(meta.tableName)
        .select('id, title, description')
        .eq('actor_id', actorId)
        .not('status', 'in', PROFILE_HIDDEN_STATUS_FILTER)
        .order('created_at', { ascending: false });
      return ((data ?? []) as Array<{ id: string; title: string; description: string | null }>).map(
        row => ({ ...row, type, href: `${meta.publicBasePath}/${row.id}` })
      );
    })
  );
  return perType.flat();
}
