/**
 * The OrangeCat → FleetCrown build handoff, as one service.
 *
 * Two callers need exactly the same thing — the "Build it with FleetCrown"
 * card on an entity page, and Cat's `send_to_fleetcrown` action — so the
 * authorization, the entity read and the signing live here once. The route is
 * an HTTP skin over this; the Cat handler is a chat skin over it.
 */

import { getEntityMetadata, isValidEntityType, type EntityType } from '@/config/entity-registry';
import { ECOSYSTEM } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { getUnclaimedOwner } from '@/domain/profileClaims/unclaimed';
import { resolveManagementRole, type ManagementRole } from '@/domain/profileClaims/stewardship';
import {
  signFleetCrownBuildIntent,
  suggestedHandoffFor,
  type FleetCrownBuildIntent,
} from './build-intent';

/** Entity types that have nothing for a builder to build. */
export const NON_BUILDABLE_ENTITY_TYPES: ReadonlySet<string> = new Set(['wallet', 'document']);

export const HANDOFF_TTL_SECONDS = 600;

export type HandoffFailure = 'invalid' | 'not_found' | 'forbidden' | 'unconfigured';

export type HandoffResult =
  | {
      ok: true;
      url: string;
      expiresInSeconds: number;
      title: string;
      role: ManagementRole;
    }
  | { ok: false; code: HandoffFailure; message: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export function isSafeSourcePath(sourcePath: unknown): sourcePath is string {
  return (
    typeof sourcePath === 'string' && sourcePath.startsWith('/') && !sourcePath.startsWith('//')
  );
}

/**
 * Build the signed handoff for one entity, or say precisely why not.
 *
 * `sourcePath` is the OrangeCat page the builder should treat as the origin —
 * always a same-origin path, never a URL the caller controls.
 */
export async function createFleetCrownHandoff(input: {
  supabase: AnySupabaseClient;
  userId: string;
  entityType: string;
  entityId: string;
  sourcePath: string;
}): Promise<HandoffResult> {
  const { supabase, userId, entityId, sourcePath } = input;
  if (
    !isValidEntityType(input.entityType) ||
    NON_BUILDABLE_ENTITY_TYPES.has(input.entityType) ||
    !UUID_RE.test(entityId) ||
    !isSafeSourcePath(sourcePath)
  ) {
    return { ok: false, code: 'invalid', message: 'Invalid build handoff' };
  }
  const entityType: EntityType = input.entityType;

  // The owner may hand it over; so may the steward of a page set up for
  // someone who has not claimed it yet (ADR-0005 D5). Nobody else.
  const role = await resolveManagementRole(supabase, userId, entityType, entityId);
  if (!role) {
    return {
      ok: false,
      code: 'forbidden',
      message:
        'Only the owner (or the person who set it up, until it is claimed) can send it to FleetCrown',
    };
  }

  const meta = getEntityMetadata(entityType);
  const titleColumn = meta.titleColumn ?? 'title';
  const admin = looseClient(getAdminClient());
  const { data: entity } = await admin
    .from(meta.tableName)
    .select(`id, ${titleColumn}, description, ${meta.userIdField}`)
    .eq('id', entityId)
    .maybeSingle();
  if (!entity) {
    return { ok: false, code: 'not_found', message: 'Entity not found' };
  }

  const row = entity as unknown as Record<string, unknown>;
  const title = String(row[titleColumn] || meta.name);
  const description = typeof row.description === 'string' ? row.description.slice(0, 1200) : null;
  const owner = await describeOwner(
    supabase,
    meta.userIdField,
    row[meta.userIdField],
    userId,
    role
  );
  const actor = await getOrCreateUserActor(userId);

  let token: string;
  try {
    token = signFleetCrownBuildIntent({
      sub: actor.id,
      entity: {
        type: entityType,
        id: entityId,
        title,
        description,
        publicUrl: new URL(sourcePath, ECOSYSTEM.orangeCat.siteUrl).toString(),
      },
      owner,
      suggestedHandoff: suggestedHandoffFor(entityType, title, owner),
    });
  } catch {
    return {
      ok: false,
      code: 'unconfigured',
      message: 'FleetCrown build handoff is not configured',
    };
  }

  const url = new URL('/integrations/orangecat/build', ECOSYSTEM.fleetCrown.siteUrl);
  url.searchParams.set('intent', token);
  return { ok: true, url: url.toString(), expiresInSeconds: HANDOFF_TTL_SECONDS, title, role };
}

/**
 * Who the builder is building FOR. A page set up for someone else names that
 * person and the steward speaking for her until she claims it — the builder's
 * first question is always "who is the client?", and the answer is here.
 */
async function describeOwner(
  supabase: AnySupabaseClient,
  ownerField: string,
  ownerValue: unknown,
  callerUserId: string,
  role: ManagementRole
): Promise<FleetCrownBuildIntent['owner']> {
  if (ownerField === 'actor_id' && typeof ownerValue === 'string') {
    const unclaimed = await getUnclaimedOwner(supabase, ownerValue);
    if (unclaimed) {
      return {
        kind: 'unclaimed',
        displayName: unclaimed.name,
        pageUrl: new URL(
          ROUTES.PROFILES.VIEW(unclaimed.slug),
          ECOSYSTEM.orangeCat.siteUrl
        ).toString(),
        stewardUsername: unclaimed.stewardUsername,
      };
    }
  }

  // The caller is the owner (or a group founder); name them by handle.
  const admin = looseClient(getAdminClient());
  const { data: profile } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .select('username, name')
    .eq('id', callerUserId)
    .maybeSingle();
  const username = (profile?.username as string | null) ?? null;
  return {
    kind: role === 'owner' ? 'user' : 'unclaimed',
    displayName: (profile?.name as string | null) ?? username ?? 'Owner',
    pageUrl: username
      ? new URL(ROUTES.PROFILES.VIEW(username), ECOSYSTEM.orangeCat.siteUrl).toString()
      : null,
    stewardUsername: null,
  };
}
