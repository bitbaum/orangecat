/**
 * Whether a person already owns anything on OrangeCat — any entity type in the
 * registry, drafts included.
 *
 * `/` sends a signed-in person whose onboarding flag is unset to the onboarding
 * wizard, unless they clearly no longer need it. That check used to count
 * projects only, so someone who had made a product, a service or a wallet was
 * sent back to "Tell Cat who you are" on every visit. Ownership comes from the
 * registry's `userIdField` (actor-owned rows against every actor the person
 * holds), so a new entity type is counted the day it is registered.
 */
import { ENTITY_REGISTRY, ENTITY_TYPES, type EntityType } from '@/config/entity-registry';
import { getUserActorIds } from '@/domain/actors';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * The first entity type (registry order) the person owns at least one row of,
 * or null. A failed count reads as none: the caller then shows onboarding,
 * which is what it did before it asked.
 */
export async function findOwnedEntityType(
  supabase: AnySupabaseClient,
  userId: string
): Promise<EntityType | null> {
  const actorIds = await getUserActorIds(supabase, userId);
  const db = looseClient(supabase);

  const counts = await Promise.all(
    ENTITY_TYPES.map(async type => {
      const { tableName, userIdField } = ENTITY_REGISTRY[type];
      if (userIdField === 'actor_id' && actorIds.length === 0) {
        return 0;
      }
      const query = db.from(tableName).select('*', { count: 'exact', head: true });
      const { count, error } = await (userIdField === 'actor_id'
        ? query.in(userIdField, actorIds)
        : query.eq(userIdField, userId));
      return error ? 0 : (count ?? 0);
    })
  );

  const index = counts.findIndex(count => count > 0);
  return index === -1 ? null : ENTITY_TYPES[index];
}
