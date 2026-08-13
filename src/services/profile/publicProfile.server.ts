/**
 * Public profile lookup domain logic (server-only).
 *
 * Resolves a profile by username OR email (with an auth.users admin fallback)
 * and attaches the public project count. Kept out of the API route so it stays
 * a thin validate → delegate → respond wrapper. Returns a discriminated result
 * the route maps to an HTTP response (no HTTP concerns in this layer).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { ENTITY_STATUS } from '@/config/database-constants';
import { getUserActorId } from '@/domain/actors';
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
 * can call it — by username OR by email — so returning the raw row (the previous
 * `select('*')` + `{ ...profile }`) leaked emails, phones, and internal blobs
 * to any caller and turned the email branch into a harvesting oracle.
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
 * Look up a public profile by username or email.
 *
 * `identifier` is expected already trimmed and non-empty (the route validates
 * presence). Email lookups first try the `profiles.email` column, then fall
 * back to resolving the user via the auth.users admin client.
 */
export async function getPublicProfileByIdentifier(
  supabase: AnySupabaseClient,
  identifier: string
): Promise<PublicProfileResult> {
  const isEmail = identifier.includes('@');

  let profile = null;
  let error = null;
  let userId: string | null = null;

  if (isEmail) {
    // Try to find profile by email field first (if it exists in profiles table)
    const { data: profileByEmail, error: emailError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('*')
      .eq('email', identifier)
      .single();

    if (!emailError && profileByEmail) {
      profile = profileByEmail;
      userId = profileByEmail.id;
    } else {
      // If email field doesn't exist in profiles, try to find user by email
      // in auth.users via the admin client. Uses the createAdminClient SSOT
      // (src/lib/supabase/admin.ts) so env-var fallback (SERVICE_ROLE_KEY
      // → SECRET_KEY → SERVICE_KEY) stays consistent with every other
      // server-side admin call.
      try {
        const adminClient = createAdminClient();
        // List users and find by email (compatible across versions)
        const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
        if (!listError && usersData?.users) {
          const user = usersData.users.find(
            u => u.email?.toLowerCase() === identifier.toLowerCase()
          );
          if (user?.id) {
            userId = user.id;
          } else {
            return { ok: false, code: 'not_found', message: 'Profile not found' };
          }
        } else {
          return { ok: false, code: 'not_found', message: 'Profile not found' };
        }

        // Now fetch the profile by user ID
        if (userId) {
          const { data: profileById, error: profileError } = await supabase
            .from(DATABASE_TABLES.PROFILES)
            .select('*')
            .eq('id', userId)
            .single();

          if (!profileError && profileById) {
            profile = profileById;
          } else {
            error = profileError;
          }
        } else {
          return { ok: false, code: 'not_found', message: 'Profile not found' };
        }
      } catch {
        // createAdminClient returns a dummy proxy when service-role env vars
        // are missing; calling .auth.admin.listUsers on it throws. That's
        // expected — fall through to suggesting the username lookup.
        return {
          ok: false,
          code: 'not_found',
          message: 'Profile not found. Please use username instead of email.',
        };
      }
    }
  } else {
    // Look up by username
    const { data: profileByUsername, error: usernameError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('*')
      .eq('username', identifier)
      .single();

    profile = profileByUsername;
    error = usernameError;
    if (profile) {
      userId = profile.id;
    }
  }

  if (error || !profile) {
    return { ok: false, code: 'not_found', message: 'Profile not found' };
  }

  // Calculate project count via actor_id (consistent with actor system)
  const resolvedUserId = userId || profile.id;
  let projectCount = 0;
  try {
    const actorId = await getUserActorId(supabase, resolvedUserId);
    if (actorId) {
      const { count } = await supabase
        .from(getTableName('project'))
        .select('*', { count: 'exact', head: true })
        .eq('actor_id', actorId)
        .neq('status', ENTITY_STATUS.DRAFT); // Exclude drafts from public view
      projectCount = count || 0;
    }
  } catch {
    // Non-fatal: profile still returned without count
  }

  return { ok: true, data: { ...toPublicProfile(profile), project_count: projectCount } };
}
