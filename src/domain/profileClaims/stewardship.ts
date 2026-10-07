/**
 * Who may act on an entity: its owner, or — while the claim is still pending —
 * the steward who set it up on someone else's behalf (ADR-0005 D5).
 *
 * This is deliberately NOT folded into `getSellerUserId`. That function answers
 * "whose wallet does money for this entity reach?", and for a placeholder the
 * honest answer is nobody's — routing it to the steward would let funds land
 * in the wrong account before the subject ever said yes. Management rights
 * and money rights are different questions; this file answers only the first.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSellerUserId } from '@/domain/payments';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export type ManagementRole = 'owner' | 'steward';

/**
 * The steward's user id for an entity owned by an unclaimed placeholder whose
 * claim is still pending; null for every other entity (claimed, declined,
 * owned by a person or a group).
 */
export async function getEntityStewardUserId(
  entityType: EntityType,
  entityId: string
): Promise<string | null> {
  const meta = getEntityMetadata(entityType);
  if (meta.userIdField !== 'actor_id') {
    return null;
  }
  const admin = looseClient(getAdminClient());
  const { data: entity } = await admin
    .from(meta.tableName)
    .select('actor_id')
    .eq('id', entityId)
    .maybeSingle();
  return getActorStewardUserId((entity?.actor_id as string | null | undefined) ?? null);
}

/**
 * The steward of an actor: the user who set up this unclaimed placeholder,
 * while its claim is still pending. Null for any other actor.
 */
export async function getActorStewardUserId(
  actorId: string | null | undefined
): Promise<string | null> {
  if (!actorId) {
    return null;
  }
  const admin = looseClient(getAdminClient());
  const { data: actor } = await admin
    .from(DATABASE_TABLES.ACTORS)
    .select('actor_type, claim_id')
    .eq('id', actorId)
    .maybeSingle();
  if (!actor || actor.actor_type !== 'unclaimed' || !actor.claim_id) {
    return null;
  }

  const { data: claim } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('created_by, status')
    .eq('id', actor.claim_id as string)
    .maybeSingle();
  if (!claim || claim.status !== 'pending') {
    return null;
  }
  return (claim.created_by as string | null) ?? null;
}

/**
 * The placeholders `userId` currently stewards — the inverse of
 * getActorStewardUserId. A booking for a studio set up for a friend is
 * addressed to the friend's placeholder actor; without this, the request
 * reached no account at all (the placeholder has none) and nobody could answer
 * it. Management only: nothing here routes money (see the header).
 */
export async function getStewardedActorIds(userId: string): Promise<string[]> {
  const admin = looseClient(getAdminClient());
  const { data: claims } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('id')
    .eq('created_by', userId)
    .eq('status', 'pending');
  const claimIds = ((claims ?? []) as Array<{ id: string }>).map(c => c.id);
  if (claimIds.length === 0) {
    return [];
  }
  const { data: actors } = await admin
    .from(DATABASE_TABLES.ACTORS)
    .select('id')
    .eq('actor_type', 'unclaimed')
    .in('claim_id', claimIds);
  return ((actors ?? []) as Array<{ id: string }>).map(a => a.id);
}

/**
 * May `userId` manage this entity — edit it, hand it to Loki, publish
 * it? Owner always; steward only while the claim is pending. Returns the role
 * so a caller can say which one applied.
 */
export async function resolveManagementRole(
  supabase: AnySupabaseClient,
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<ManagementRole | null> {
  const ownerId = await getSellerUserId(
    supabase as Parameters<typeof getSellerUserId>[0],
    entityType,
    entityId
  );
  if (ownerId === userId) {
    return 'owner';
  }
  const stewardId = await getEntityStewardUserId(entityType, entityId);
  return stewardId === userId ? 'steward' : null;
}
