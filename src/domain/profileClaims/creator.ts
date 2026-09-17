/**
 * The CREATOR's half of profile claims.
 *
 * ADR-0004 D4 split a claim's two addresses: `token` is the credential that
 * travels in a link and addresses everything the PUBLIC does — preview, claim,
 * decline. `id` is the row's identity and addresses what its CREATOR does —
 * list, fetch for the share screen, revoke. This file is that second half, and
 * the split exists so a reader can tell at a glance which functions are
 * reachable with a link and which require being the person who made it.
 *
 * Everything here goes through the service-role admin client:
 * `public.profile_claims` has no anon/authenticated RLS policies, deliberately
 * (see the migration for why a permissive one would leak every draft).
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import { normalizeClaimDraft } from './draft';
import type { ProfileClaimResult, ProfileClaimRow } from './types';

export async function listProfileClaimsCreatedBy(
  createdBy: string
): Promise<ProfileClaimResult<ProfileClaimRow[]>> {
  const { data, error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('*')
    .eq('created_by', createdBy)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to list profile claims', { error, createdBy });
    return { ok: false, dbError: error };
  }
  return { ok: true, data: (data ?? []) as ProfileClaimRow[] };
}

/**
 * Creator-only: everything the share screen needs for one claim.
 *
 * Addressed by row `id`, not token — this is the CREATOR's view of their own
 * claim, and the token is returned in it precisely because the creator is the
 * one person who is supposed to have it (they are about to send it).
 */
export async function getProfileClaimForCreator(
  id: string,
  requestedBy: string
): Promise<
  ProfileClaimResult<{
    token: string;
    name: string;
    status: string;
    slug: string | null;
    /** The placeholder actor, so the caller can look up what was set up for them. */
    actorId: string | null;
  }>
> {
  const admin = looseClient(getAdminClient());
  const { data: row, error } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('created_by, token, draft, status, actor_id')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { ok: false, dbError: error };
  }
  // Not-found rather than forbidden for someone else's claim: whether a given
  // id exists is not a stranger's business.
  if (!row || row.created_by !== requestedBy) {
    return { ok: false, code: 'not_found', message: 'Claim not found' };
  }

  const draft = normalizeClaimDraft(row.draft);
  if (!draft) {
    return { ok: false, code: 'not_found', message: 'Claim not found' };
  }

  // What was set up for them is deliberately NOT queried here. `projects` is
  // an entity table addressed through `getTableName()`, and the schema-drift
  // scanner resolves columns against the nearest preceding literal
  // `.from(DATABASE_TABLES.X)` — a dynamic table name in this file would make
  // `title` look like a column of `actors`. The caller looks it up instead.
  let slug: string | null = null;
  if (row.actor_id) {
    const { data: actor } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .select('slug')
      .eq('id', row.actor_id)
      .maybeSingle();
    slug = (actor?.slug as string | undefined) ?? null;
  }

  return {
    ok: true,
    data: {
      token: row.token as string,
      name: draft.profile.name,
      status: row.status as string,
      slug,
      actorId: (row.actor_id as string | null) ?? null,
    },
  };
}

/** Creator-only: pull a link before anyone uses it. */
export async function revokeProfileClaim(
  id: string,
  requestedBy: string
): Promise<ProfileClaimResult<null>> {
  const { data: row, error: fetchError } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('created_by, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, dbError: fetchError };
  }
  if (!row) {
    return { ok: false, code: 'not_found', message: 'Claim not found' };
  }
  if (row.created_by !== requestedBy) {
    return { ok: false, code: 'not_found', message: 'Claim not found' };
  }
  if (row.status !== 'pending') {
    return { ok: false, code: 'already_claimed', message: 'Only a pending claim can be revoked' };
  }

  const { error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) {
    return { ok: false, dbError: error };
  }
  return { ok: true, data: null };
}
