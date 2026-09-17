/**
 * Public profile lookup domain logic (server-only).
 *
 * Resolves a profile by username and attaches the public project count. Email
 * lookup was removed — see getPublicProfileByIdentifier. Kept out of the API route so it stays
 * a thin validate → delegate → respond wrapper. Returns a discriminated result
 * the route maps to an HTTP response (no HTTP concerns in this layer).
 */

import { PUBLIC_PROFILES_VIEW } from '@/config/database-tables';
import { looseClient } from '@/lib/supabase/untyped';
import { getTableName } from '@/config/entity-registry';
import { ENTITY_STATUS } from '@/config/database-constants';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { applyProfilePrivacy } from '@/config/profile-privacy';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export type PublicProfileErrorCode = 'not_found';

export type PublicProfileResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: PublicProfileErrorCode; message: string }
  | { ok: false; dbError: unknown };

/**
 * Account PII / internal columns on the `profiles` row that must NEVER be
 * returned from the UNAUTHENTICATED (withOptionalAuth) profile endpoint. Anyone
 * can call it, so returning the raw row (the previous `select('*')` +
 * `{ ...profile }`) leaked emails, phones, and internal blobs to any caller —
 * and the by-email branch it also had was a harvesting oracle, since removed.
 *
 * This is a DENYLIST, not an allowlist, on purpose: `src/types/database.ts`
 * drifts from the live schema (prod has columns like `background`,
 * `inspiration_statement`, `location_context` that aren't typed here), so an
 * allowlist would silently drop real public display fields. New sensitive
 * columns MUST be added here. Contact is via in-app messaging, not raw email.
 */
const SENSITIVE_PROFILE_FIELDS = [
  'email',
  'contact_email',
  'phone',
  'verification_data',
  'privacy_settings',
  'payment_preferences',
  'preferences',
  'metadata',
  'last_login_at',
  'last_active_at',
  'onboarding_completed',
  'onboarding_wallet_setup_completed',
  'onboarding_first_project_created',
  'onboarding_method',
  'profile_completed_at',
  'terms_accepted_at',
  'privacy_policy_accepted_at',
  'location_search',
] as const;

function toPublicProfile(profile: Record<string, unknown>): Record<string, unknown> {
  // This endpoint is unauthenticated and serves the public view, so honour the
  // owner's per-field hide list (privacy_settings.hidden_fields) BEFORE the
  // denylist below strips privacy_settings itself. isOwner: false — an owner who
  // wants their full row uses the authenticated GET /api/profile.
  const clean: Record<string, unknown> = applyProfilePrivacy({ ...profile }, { isOwner: false });
  for (const field of SENSITIVE_PROFILE_FIELDS) {
    delete clean[field];
  }
  return clean;
}

/**
 * Look up a public profile by username.
 *
 * `identifier` is expected already trimmed and non-empty (the route validates
 * presence). An identifier that looks like an email address is refused rather
 * than resolved: this endpoint is unauthenticated, so answering it would tell
 * any caller whether a given address has an account here.
 */
export async function getPublicProfileByIdentifier(
  supabase: AnySupabaseClient,
  identifier: string
): Promise<PublicProfileResult> {
  const isEmail = identifier.includes('@');

  // The row comes from a view read through looseClient, so it arrives untyped
  // (`{}`) — name the one field this function actually reaches into.
  let profile: (Record<string, unknown> & { id: string }) | null = null;
  let error = null;
  let userId: string | null = null;

  if (isEmail) {
    // Looking a person up BY EMAIL is not something an unauthenticated endpoint
    // should answer, so it no longer does.
    //
    // The comment on SENSITIVE_PROFILE_FIELDS above already called this branch
    // a harvesting oracle: anyone could confirm, one address at a time, whether
    // an email has an account here and get the matching handle back. Stripping
    // the columns from the RESPONSE never fixed that — the answer was the
    // existence of the row, not the fields on it.
    //
    // It is also unreachable from the product: nothing in src/ calls
    // /api/profile/[identifier] at all, let alone with an address. The two ways
    // it used to answer are both gone — `.eq('email', …)` because `anon` no
    // longer holds SELECT on profiles.email (migration 20260917120100), and the
    // auth.users admin fallback because service_role would have walked straight
    // around that grant and kept the oracle alive.
    return {
      ok: false,
      code: 'not_found',
      message: 'Profile not found. Please use username instead of email.',
    };
  }

  // Look up by username, against the PUBLIC VIEW.
  //
  // This route is withOptionalAuth, so `supabase` is the anon-key client and a
  // logged-out caller reaches Postgres as `anon` — which no longer holds SELECT
  // on profiles.email/.phone/.contact_email, so `select('*')` on the table would
  // now fail outright. public_profiles carries the same row minus the account
  // email, with the owner's privacy_settings applied in SQL.
  //
  // toPublicProfile() below still runs its denylist over the result. That is
  // now belt-and-braces rather than the only guard, and it stays: it is what
  // keeps this endpoint's contract identical for phone/contact_email, which the
  // view returns (masked) but this endpoint has always withheld outright.
  const { data: profileByUsername, error: usernameError } = await looseClient(supabase)
    .from(PUBLIC_PROFILES_VIEW)
    .select('*')
    .eq('username', identifier)
    .single();

  profile = profileByUsername as (Record<string, unknown> & { id: string }) | null;
  error = usernameError;
  if (profile) {
    userId = profile.id;
  }

  if (error || !profile) {
    return { ok: false, code: 'not_found', message: 'Profile not found' };
  }

  // Calculate project count via actor_id (consistent with actor system)
  const resolvedUserId = userId || profile.id;
  let projectCount = 0;
  try {
    const actor = await getOrCreateUserActor(resolvedUserId);
    const { count } = await supabase
      .from(getTableName('project'))
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', actor.id)
      .neq('status', ENTITY_STATUS.DRAFT); // Exclude drafts from public view
    projectCount = count || 0;
  } catch {
    // Non-fatal: profile still returned without count
  }

  return { ok: true, data: { ...toPublicProfile(profile), project_count: projectCount } };
}
