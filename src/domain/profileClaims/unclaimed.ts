/**
 * Reading an unclaimed actor for the surfaces that render it.
 *
 * ADR-0005: a placeholder is a real `actors` row with a display name, an avatar
 * and a slug, owning real entity rows, and with NO profile — so every UI that
 * resolves an owner through `actors.user_id → profiles` finds nothing and
 * would otherwise render "Anonymous". One helper, used by the project page and
 * the profile-slug fallback, so the two cannot drift.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { looseClient } from '@/lib/supabase/untyped';
import { getAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface UnclaimedOwner {
  actorId: string;
  name: string;
  avatarUrl: string | null;
  /** Public address while unclaimed: `/profiles/<slug>`. */
  slug: string;
  /** Who set it up — for the band's "Set up by @x for Maria". */
  stewardUsername: string | null;
}

/** The placeholder that owns this actor id, or null if it is a normal actor. */
export async function getUnclaimedOwner(
  supabase: AnySupabaseClient,
  actorId: string | null | undefined
): Promise<UnclaimedOwner | null> {
  if (!actorId) {
    return null;
  }
  const { data } = await looseClient(supabase)
    .from(DATABASE_TABLES.ACTORS)
    .select('id, actor_type, display_name, avatar_url, slug, claim_id')
    .eq('id', actorId)
    .maybeSingle();

  if (!data || data.actor_type !== 'unclaimed') {
    return null;
  }
  return {
    actorId: data.id as string,
    name: (data.display_name as string | null) ?? 'Someone',
    avatarUrl: (data.avatar_url as string | null) ?? null,
    slug: (data.slug as string) ?? '',
    stewardUsername: await stewardOf(supabase, data.claim_id as string | null),
  };
}

/**
 * The account behind an actor — a person's own actor has one, a group's actor
 * resolves to nothing here (groups are not accounts), a placeholder has none.
 */
export async function resolveActorUserId(
  supabase: AnySupabaseClient,
  actorId: string | null | undefined
): Promise<string | null> {
  if (!actorId) {
    return null;
  }
  const { data } = await looseClient(supabase)
    .from(DATABASE_TABLES.ACTORS)
    .select('user_id')
    .eq('id', actorId)
    .maybeSingle();
  return (data?.user_id as string | null | undefined) ?? null;
}

/** A handle for attribution ("Set up by @x"), or null when the account has none. */
export async function usernameOf(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await looseClient(supabase)
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  return (data?.username as string | null | undefined) ?? null;
}

/** The placeholder addressed by `/profiles/<slug>`, or null. */
export async function getUnclaimedOwnerBySlug(
  supabase: AnySupabaseClient,
  slug: string
): Promise<UnclaimedOwner | null> {
  // The unique index is on `lower(slug)`, so the lookup matches on it too — a
  // link shared with different capitalisation must reach the same page.
  const { data } = await looseClient(supabase)
    .from(DATABASE_TABLES.ACTORS)
    .select('id, actor_type, display_name, avatar_url, slug, claim_id')
    .eq('actor_type', 'unclaimed')
    .ilike('slug', slug)
    .maybeSingle();

  if (!data) {
    return null;
  }
  return {
    actorId: data.id as string,
    name: (data.display_name as string | null) ?? 'Someone',
    avatarUrl: (data.avatar_url as string | null) ?? null,
    slug: (data.slug as string) ?? slug,
    stewardUsername: await stewardOf(supabase, data.claim_id as string | null),
  };
}

/**
 * The steward's handle, for attribution on the band.
 *
 * Never the claim TOKEN: that is the credential, and a public page must not
 * carry the thing that lets any visitor take the page over.
 */
async function stewardOf(
  _supabase: AnySupabaseClient,
  claimId: string | null
): Promise<string | null> {
  if (!claimId) {
    return null;
  }
  // profile_claims has NO RLS policies (service-role only, ADR-0004), so a
  // session or anonymous client reads nothing here — which rendered every band
  // as "This belongs to Maria" with no steward, and every handoff with
  // stewardUsername null. The handle is a public fact; the token never leaves.
  const supabase = looseClient(getAdminClient()) as unknown as AnySupabaseClient;
  const { data: claim } = await looseClient(supabase)
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('created_by')
    .eq('id', claimId)
    .maybeSingle();
  if (!claim?.created_by) {
    return null;
  }
  const { data: profile } = await looseClient(supabase)
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('id', claim.created_by as string)
    .maybeSingle();
  return (profile?.username as string | undefined) ?? null;
}
