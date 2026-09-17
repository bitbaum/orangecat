/**
 * Resolve the actor that will own a newly-created entity.
 *
 * Defaults to the user's personal actor. If the caller requests a different
 * actor (e.g. the actor of a group the user belongs to), verify they have
 * authority — founder / admin / moderator role in the linked group. Anything
 * else throws ActorNotPermittedError, which API handlers convert to 403.
 *
 * Created: 2026-06-03
 * Last Modified: 2026-06-03
 * Last Modified Summary: Initial implementation — unlocks the "create as group" actor switcher in entity wizards.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getOrCreateUserActor } from './getOrCreateUserActor';

export class ActorNotPermittedError extends Error {
  constructor(public actorId: string) {
    super(`User is not permitted to create entities as actor ${actorId}`);
    this.name = 'ActorNotPermittedError';
  }
}

/**
 * Roles that may act for a group.
 *
 * 'moderator' used to be in this list and could never match: the
 * `group_members_role_check` constraint permits only founder | admin | member,
 * so a moderator row cannot exist. (`membership_role_enum` does contain
 * 'moderator', but no table uses that type — it is an orphan.) Filtering on an
 * impossible value is not harmless: it reads as "moderators can create for
 * their group", which is a capability nobody has.
 *
 * Kept as the one list, asserted against the constraint by
 * __tests__/unit/config/privileged-roles-exist.test.ts.
 */
export const PRIVILEGED_ROLES = ['founder', 'admin'] as const;

/**
 * @param userId - The authenticated user.
 * @param requestedActorId - Optional actor the user is asking to create as.
 *        `null`/`undefined` means "use personal actor".
 * @throws ActorNotPermittedError when the user lacks rights to act as the requested actor.
 */
export async function resolveCreationActor(
  userId: string,
  requestedActorId?: string | null
): Promise<{ id: string }> {
  if (!requestedActorId) {
    return getOrCreateUserActor(userId);
  }

  const admin = createAdminClient();

  // One query against actors. Schema: actors has user_id (for personal
  // actors) AND group_id (for group actors); groups has NO inverse
  // pointer back to actors. Personal actor of the requesting user is
  // trivially allowed; group actor case continues to the membership check.
  const { data: actorRow } = await admin
    .from(DATABASE_TABLES.ACTORS)
    .select('id, actor_type, user_id, group_id')
    .eq('id', requestedActorId)
    .maybeSingle();

  const actor = actorRow as {
    actor_type: string;
    user_id: string | null;
    group_id: string | null;
  } | null;

  if (actor && actor.actor_type === 'user' && actor.user_id === userId) {
    return { id: requestedActorId };
  }

  // ADR-0005 D5 — the steward. An unclaimed actor is a person set up on
  // someone else's behalf; whoever created its claim may create for it and
  // edit what it owns, but only while the claim is still pending. The moment
  // it is accepted the placeholder is gone; the moment it is declined, so is
  // everything it owned. Either way this clause then matches nothing.
  if (actor?.actor_type === 'unclaimed') {
    const { data: claim } = await looseClient(admin)
      .from(DATABASE_TABLES.PROFILE_CLAIMS)
      .select('created_by, status')
      .eq('actor_id', requestedActorId)
      .maybeSingle();
    const isSteward = claim?.created_by === userId && claim?.status === 'pending';
    if (isSteward) {
      return { id: requestedActorId };
    }
    logger.warn('resolveCreationActor: caller is not the steward of this unclaimed actor', {
      requestedActorId,
      userId,
    });
    throw new ActorNotPermittedError(requestedActorId);
  }

  const groupId = actor?.actor_type === 'group' ? actor.group_id : null;
  if (!groupId) {
    logger.warn('resolveCreationActor: actor is neither own personal actor nor a group actor', {
      requestedActorId,
      userId,
    });
    throw new ActorNotPermittedError(requestedActorId);
  }

  const { data: membership } = await admin
    .from(DATABASE_TABLES.GROUP_MEMBERS)
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .in('role', PRIVILEGED_ROLES as unknown as string[])
    .maybeSingle();

  if (!membership) {
    logger.warn('resolveCreationActor: user lacks privileged role in group', {
      requestedActorId,
      groupId,
      userId,
    });
    throw new ActorNotPermittedError(requestedActorId);
  }

  return { id: requestedActorId };
}
