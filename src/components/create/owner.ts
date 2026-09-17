/**
 * Who the thing being created will belong to.
 *
 * ADR-0004 D8. The create form already had a "Create this on behalf of"
 * selector covering *me* and *a group I run*, with real server-side
 * authorization behind it (`resolveCreationActor` → 403). What it could not do
 * is name a person who has no account, because such a person has no `actors`
 * row — and giving them one is the alternative ADR-0004 rejects, since ~24
 * tables join `actors` and `actors.user_id` has no FK, which would demote the
 * money guarantee from structural to conventional.
 *
 * ADR-0005 resolves it: the person becomes an `unclaimed` ACTOR — an
 * identity that owns rows and cannot receive money — so the third option is
 * two requests on the same rail, not a different rail:
 *
 *   me           → POST /api/<entity>
 *   group        → POST /api/<entity> { actor_id: <group actor> }
 *   someone else → POST /api/profile-claims { name }  → placeholder actor_id
 *                  POST /api/<entity> { actor_id: <placeholder> }
 *
 * Same form, same fields, same validation, same server-side authorization
 * (`resolveCreationActor` admits the claim's steward). A studio set up for
 * Maria has exactly the fields a studio has, and is hers from the first row.
 */

import type { EntityType } from '@/config/entity-registry';

/** `EntityConfig.type` is an EntityType OR the legacy literal 'organization'. */
type ConfigEntityType = EntityType | 'organization';

export type CreateOwner =
  | { kind: 'me' }
  | { kind: 'group'; actorId: string }
  | { kind: 'someone-else'; name: string };

export const OWNER_ME: CreateOwner = { kind: 'me' };

/**
 * Entity types that can be created for someone who has no account yet.
 *
 * ADR-0005: the thing is a real row owned by the person's placeholder actor,
 * so any `actor_id`-owned entity on the shared create rail qualifies in
 * principle. It is offered ONLY where the public page renders the unclaimed
 * band and disables funding — otherwise a visitor sees a page with no
 * explanation of whose it is. Projects first: that is the fundable, "she
 * needs money for a studio" case. Groups are excluded by structure, not by
 * choice — a group's owner is a `group_members` row, and that FKs to
 * `profiles`, which a placeholder does not have.
 */
export const CLAIMABLE_ENTITY_TYPES: readonly EntityType[] = ['project'];

export function canCreateForSomeoneElse(entityType: ConfigEntityType): boolean {
  return CLAIMABLE_ENTITY_TYPES.includes(entityType as EntityType);
}
