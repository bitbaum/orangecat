/**
 * Profile claim domain logic (server-only).
 *
 * `public.profile_claims` has no anon/authenticated RLS policies — every
 * function here reads and writes it through the service-role admin client.
 * See the migration for why a permissive "pending rows are viewable" policy
 * would leak every draft platform-wide instead of just the one the caller
 * holds the credential for.
 *
 * TWO ADDRESSES, ON PURPOSE (ADR-0004 D4). `token` is the credential: it is
 * what `/claim/<token>` carries, and it addresses every PUBLIC operation —
 * preview, claim, decline. `id` is the row's identity and addresses the
 * CREATOR's operations — list, revoke. They used to be the same column, which
 * meant a claim could never be named anywhere public, because its public name
 * was its password.
 *
 * Applying a claimed draft to the recipient's own `profiles` row uses the
 * *caller's* request-scoped client instead — that update stays inside
 * existing "users can update their own profile" RLS, no elevated
 * privilege needed for it.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { reservedReason } from '@/config/usernames';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient, callRpc } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { wantsHandle, buildProfileFill, type ExistingProfileFields } from './fill';
import { normalizeClaimDraft, type ClaimDraft } from './draft';
import { slugify } from '@/utils/string';
import type { ProfileClaimPreview, ProfileClaimResult, ProfileClaimRow } from './types';

const MAX_USERNAME_SUFFIX_ATTEMPTS = 6;

// Every function below calls `.from(DATABASE_TABLES.PROFILE_CLAIMS)` inline —
// deliberately not through a shared helper. scripts/db/audit-schema-drift.mjs
// (the CD schema-drift gate) statically resolves `.select()`/`.eq()`/
// `.update()` calls by scanning the text window after the *nearest preceding*
// literal `.from(DATABASE_TABLES.X)` in the file; a wrapper that hides that
// call behind a function name makes it invisible to the scanner, and every
// column reference after it gets silently misattributed to whichever table
// the scanner last resolved (here: `profiles`, from the lookup in
// getProfileClaimPreview) — false-positive drift that blocked deploy 2026-08-18.

function isExpired(row: Pick<ProfileClaimRow, 'expires_at'>): boolean {
  return new Date(row.expires_at).getTime() < Date.now();
}

export async function createProfileClaim(input: {
  createdBy: string;
  draft: ClaimDraft;
  suggestedUsername?: string;
}): Promise<ProfileClaimResult<{ id: string; token: string; actorId: string; slug: string }>> {
  const admin = looseClient(getAdminClient());

  const { data, error } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .insert({
      created_by: input.createdBy,
      draft: input.draft,
      suggested_username: input.suggestedUsername?.trim().toLowerCase() || null,
    })
    .select('id, token')
    .single();

  if (error || !data) {
    logger.error('Failed to create profile claim', { error, createdBy: input.createdBy });
    return { ok: false, dbError: error };
  }
  const claimId = data.id as string;

  // ADR-0005 D1 — the person exists from minute one, as an ACTOR: a nameable,
  // addressable identity that owns real rows and cannot receive money (no
  // profile ⇒ no Lightning address; the wallet guard refuses the rest). The
  // slug is the public address until a username exists, so it is allocated
  // unique among placeholders; a clash just gets a numeric suffix.
  const base =
    slugify(input.draft.profile.name, { maxLength: 40, randomSuffix: false }) || 'someone';
  let actorId: string | null = null;
  let slug = base;
  for (let attempt = 0; attempt < 6 && !actorId; attempt++) {
    slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data: actor, error: actorError } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .insert({
        actor_type: 'unclaimed',
        display_name: input.draft.profile.name,
        avatar_url: input.draft.profile.avatarUrl ?? null,
        slug,
        claim_id: claimId,
      })
      .select('id')
      .single();
    if (actor) {
      actorId = actor.id as string;
    } else if ((actorError as { code?: string } | null)?.code !== '23505') {
      logger.error('Failed to create placeholder actor', { error: actorError, claimId });
      await admin.from(DATABASE_TABLES.PROFILE_CLAIMS).delete().eq('id', claimId);
      return { ok: false, dbError: actorError };
    }
  }
  if (!actorId) {
    await admin.from(DATABASE_TABLES.PROFILE_CLAIMS).delete().eq('id', claimId);
    return {
      ok: false,
      code: 'not_found',
      message: 'Could not find a free address for this name.',
    };
  }

  const { error: linkError } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .update({ actor_id: actorId })
    .eq('id', claimId);
  if (linkError) {
    logger.error('Failed to link placeholder actor to claim', { error: linkError, claimId });
    return { ok: false, dbError: linkError };
  }

  // `id` addresses the row for its creator; `token` is the credential that
  // goes in the link. Callers building a URL must use the token.
  return { ok: true, data: { id: claimId, token: data.token as string, actorId, slug } };
}

/**
 * Public preview for the claim landing page — no auth required to view.
 *
 * Addressed by TOKEN, never by id: the landing page is a public URL, and the
 * thing in that URL must be the credential rather than the row's identity.
 */
export async function getProfileClaimPreview(
  token: string,
  options?: {
    /**
     * Record this read in the funnel. Off by default and opted into exactly
     * once per page load: Next calls `generateMetadata` and the page body
     * separately, so counting inside the fetch itself made every visit look
     * like two.
     */
    countView?: boolean;
  }
): Promise<ProfileClaimResult<ProfileClaimPreview>> {
  const { data: row, error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load profile claim', { error });
    return { ok: false, dbError: error };
  }
  if (!row) {
    return { ok: false, code: 'not_found', message: 'This claim link doesn’t exist.' };
  }

  const typed = row as ProfileClaimRow;

  // Rows written before the draft grew an `entities[]` array carry the old flat
  // person shape. Normalising on read means a link already sent to a real
  // person keeps working instead of rendering an empty card.
  const draft = normalizeClaimDraft(typed.draft);
  if (!draft) {
    logger.error('Profile claim has an unreadable draft', { status: typed.status });
    return { ok: false, code: 'not_found', message: 'This claim link doesn’t exist.' };
  }

  let claimedUsername: string | null = null;
  if (typed.status === 'claimed' && typed.claimed_by) {
    const { data: profile } = await looseClient(getAdminClient())
      .from(DATABASE_TABLES.PROFILES)
      .select('username')
      .eq('id', typed.claimed_by)
      .maybeSingle();
    claimedUsername = (profile?.username as string | undefined) ?? null;
  }

  // "Sent but never opened" and "opened and ignored" are the two ends of the
  // funnel a creator actually needs to tell apart before nudging. Recorded
  // best-effort: a failure here must never stop a recipient seeing the page.
  if (options?.countView && typed.status === 'pending') {
    const { error: viewError } = await looseClient(getAdminClient())
      .from(DATABASE_TABLES.PROFILE_CLAIMS)
      .update({
        first_viewed_at: typed.first_viewed_at ?? new Date().toISOString(),
        view_count: (typed.view_count ?? 0) + 1,
      })
      .eq('token', token);
    if (viewError) {
      logger.warn('Failed to record claim view', { error: viewError });
    }
  }

  let actorSlug: string | null = null;
  if (typed.actor_id) {
    const { data: actor } = await looseClient(getAdminClient())
      .from(DATABASE_TABLES.ACTORS)
      .select('slug')
      .eq('id', typed.actor_id)
      .maybeSingle();
    actorSlug = (actor?.slug as string | undefined) ?? null;
  }

  return {
    ok: true,
    data: {
      token: typed.token,
      draft,
      actorSlug,
      suggestedUsername: typed.suggested_username,
      status: typed.status,
      isExpired: typed.status === 'pending' && isExpired(typed),
      claimedUsername,
    },
  };
}

/**
 * The recipient says no.
 *
 * Deliberately needs no account and no login. Requiring someone to register in
 * order to refuse something they never asked for would make "no" more
 * expensive than "yes", which is not consent. Holding the token is the whole
 * authorisation — the same credential that would have let them accept.
 *
 * Distinct from `revoked`, which is the creator withdrawing the link.
 */
export async function declineProfileClaim(token: string): Promise<ProfileClaimResult<null>> {
  const admin = looseClient(getAdminClient());
  const { data: row, error: fetchError } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('id, status, actor_id')
    .eq('token', token)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, dbError: fetchError };
  }
  if (!row) {
    return { ok: false, code: 'not_found', message: 'This claim link doesn’t exist.' };
  }
  if (row.status === 'claimed') {
    return { ok: false, code: 'already_claimed', message: 'This has already been claimed.' };
  }
  // Declining twice is a no-op, not an error: someone tapping "no thanks"
  // again should not be told they did something wrong.
  if (row.status === 'declined') {
    return { ok: true, data: null };
  }

  if (row.actor_id) {
    // ADR-0005 D6 — her name comes down, and nothing is left ownerless. The
    // function deletes every row the placeholder owns BEFORE the placeholder
    // (10 of the 25 owner FKs are SET NULL), then marks the claim declined,
    // all in one transaction.
    const { error } = await callRpc(getAdminClient(), 'decline_placeholder_actor', {
      p_claim_id: row.id,
    });
    if (error) {
      return { ok: false, dbError: error };
    }
    return { ok: true, data: null };
  }

  const { error } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .update({ status: 'declined', declined_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'pending');
  if (error) {
    return { ok: false, dbError: error };
  }
  return { ok: true, data: null };
}

async function findAvailableUsername(
  supabase: AnySupabaseClient,
  desired: string,
  userId: string
): Promise<string | null> {
  const base = desired
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  if (!base) {
    return null;
  }

  for (let attempt = 0; attempt < MAX_USERNAME_SUFFIX_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    // A draft written before the route validated against the shared schema can
    // still carry a reserved name, and the `-2` suffixes are built here rather
    // than validated anywhere. Ask the SSOT for every candidate.
    if (reservedReason(candidate) !== null) {
      continue;
    }

    // `username_lower` is a STORED generated column and carries the UNIQUE
    // index. Probing `username` with `.eq` is case-SENSITIVE while uniqueness
    // is not, so a candidate differing only in case read as free and then
    // failed the insert — after the claim had already been flipped to
    // `claimed`, landing in the rollback path.
    const { data: taken } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id')
      .eq('username_lower', candidate.toLowerCase())
      .neq('id', userId)
      .maybeSingle();
    if (!taken) {
      return candidate;
    }
  }
  return null;
}

/**
 * Complete a claim.
 *
 * Two shapes of claim exist. A claim with a placeholder actor (ADR-0005) hands
 * over real rows: `claim_placeholder_actor()` moves ownership across every FK
 * to actors(id) in ONE transaction, then the profile is filled from the draft
 * where blank (D6) and the placeholder's slug becomes the handle if it is free
 * and unreserved — through `findAvailableUsername`, which is the only door
 * into `profiles.username` and the one that consults RESERVED_USERNAMES.
 *
 * A legacy claim (no placeholder) compare-and-swaps `status → claimed` and
 * fills the profile, as before.
 *
 * `userSupabase` must be the caller's request-scoped client — the profiles
 * update runs through it so it stays inside normal "own row" RLS.
 */
export async function claimProfileClaim(params: {
  claimToken: string;
  userId: string;
  userSupabase: AnySupabaseClient;
}): Promise<ProfileClaimResult<{ username: string | null; pageSlug: string | null }>> {
  const { claimToken, userId, userSupabase } = params;
  const admin = looseClient(getAdminClient());

  const { data: existing, error: fetchError } = await admin
    .from(DATABASE_TABLES.PROFILE_CLAIMS)
    .select('*')
    .eq('token', claimToken)
    .maybeSingle();
  if (fetchError) {
    return { ok: false, dbError: fetchError };
  }
  if (!existing) {
    return { ok: false, code: 'not_found', message: 'This claim link doesn’t exist.' };
  }
  const row = existing as ProfileClaimRow;
  if (row.status === 'revoked') {
    return { ok: false, code: 'revoked', message: 'This claim link was revoked.' };
  }
  if (row.status === 'declined') {
    // The recipient already said no. Re-claiming would quietly undo a refusal.
    return { ok: false, code: 'declined', message: 'This was declined.' };
  }
  if (row.status === 'claimed') {
    return {
      ok: false,
      code: 'already_claimed',
      message: 'This profile has already been claimed.',
    };
  }
  if (isExpired(row)) {
    return { ok: false, code: 'expired', message: 'This claim link has expired.' };
  }

  const draft = normalizeClaimDraft(row.draft);
  if (!draft) {
    logger.error('Refusing to claim an unreadable draft', { userId });
    return { ok: false, code: 'not_found', message: 'This claim link doesn’t exist.' };
  }

  let placeholderSlug: string | null = null;

  if (row.actor_id) {
    const { data: actor } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .select('slug')
      .eq('id', row.actor_id)
      .maybeSingle();
    placeholderSlug = (actor?.slug as string | undefined) ?? null;

    // One transaction: verifies pending + unclaimed, moves every owned row to
    // the claimer's actor, marks the claim, deletes the placeholder. Two tabs
    // cannot both win — the function takes the claim row FOR UPDATE.
    const { error: rpcError } = await callRpc(getAdminClient(), 'claim_placeholder_actor', {
      p_claim_id: row.id,
      p_claimer: userId,
    });
    if (rpcError) {
      const code = (rpcError as { code?: string }).code;
      if (code === '23514' || code === 'P0002') {
        return { ok: false, code: 'already_claimed', message: 'This has already been claimed.' };
      }
      return { ok: false, dbError: rpcError };
    }
  } else {
    const nowIso = new Date().toISOString();
    const { data: won, error: casError } = await admin
      .from(DATABASE_TABLES.PROFILE_CLAIMS)
      .update({ status: 'claimed', claimed_by: userId, claimed_at: nowIso })
      .eq('token', claimToken)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (casError) {
      return { ok: false, dbError: casError };
    }
    if (!won) {
      // Someone else won the race between our read and this update.
      return {
        ok: false,
        code: 'already_claimed',
        message: 'This profile has already been claimed.',
      };
    }
  }

  // Fill only what is EMPTY (ADR-0004 D6). A claim is a gift, not an
  // overwrite: it may add to a profile, never replace what its owner wrote.
  const { data: current } = await userSupabase
    .from(DATABASE_TABLES.PROFILES)
    .select('name, bio, avatar_url, banner_url, website, social_links, username')
    .eq('id', userId)
    .maybeSingle();

  // The handle: the suggested one if any, else the placeholder's slug — so the
  // URL her friends already shared keeps working after she signs up (D7).
  // Only when she has none or a minted `user_<hex>` one (a "Start instantly"
  // account has that from minute one and it is nobody's choice); never over a
  // handle she picked.
  let username: string | null = null;
  const desiredHandle = row.suggested_username ?? placeholderSlug;
  if (wantsHandle(current?.username as string | null | undefined, desiredHandle)) {
    username = await findAvailableUsername(userSupabase, desiredHandle as string, userId);
  }

  const profileUpdate = buildProfileFill(draft.profile, current as ExistingProfileFields, username);

  let finalUsername = (current?.username as string | undefined) ?? null;
  if (Object.keys(profileUpdate).length > 0) {
    const { data: updatedProfile, error: profileError } = await userSupabase
      .from(DATABASE_TABLES.PROFILES)
      .update(profileUpdate)
      .eq('id', userId)
      .select('username')
      .single();
    if (profileError || !updatedProfile) {
      // Ownership has already moved and that is the part that matters; a
      // profile fill that failed is reported, not rolled back over.
      logger.error('Claim succeeded but the profile fill failed', { error: profileError, userId });
      return { ok: true, data: { username: finalUsername, pageSlug: placeholderSlug } };
    }
    finalUsername = (updatedProfile.username as string | undefined) ?? null;
  }

  return { ok: true, data: { username: finalUsername, pageSlug: placeholderSlug } };
}
