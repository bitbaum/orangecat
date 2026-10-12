/**
 * The claims an app receives about a person: what the scopes allow, minus what
 * the person chose to keep back from THAT app. Used for the id token and for
 * userinfo, so both always agree.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { cleanWithheldClaims, type ProfileClaim } from '@/lib/oauth/config';

function adminDb(): AnySupabaseClient {
  return createAdminClient() as unknown as AnySupabaseClient;
}

/**
 * The profile claims this person has chosen not to show this app (Connected
 * apps, or the consent screen). Empty for an app with no remembered grant, so
 * a first sign-in shows everything the scopes allow until the person says
 * otherwise.
 */
async function withheldClaimsFor(userId: string, clientId: string): Promise<ProfileClaim[]> {
  const { data } = await adminDb()
    .from(DATABASE_TABLES.OAUTH_USER_GRANTS)
    .select('withheld_claims')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle();
  return cleanWithheldClaims(data?.withheld_claims);
}

/**
 * `clientId` names the app the claims are FOR. Without it nothing is withheld,
 * which is only right for callers that are not an app (none today).
 */
export async function profileClaims(
  userId: string,
  scopes: string[],
  clientId?: string
): Promise<Record<string, unknown>> {
  if (!scopes.includes('profile') && !scopes.includes('email')) {
    return {};
  }
  const { data: profile } = await adminDb()
    .from(DATABASE_TABLES.PROFILES)
    .select('username, name, avatar_url, email')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) {
    return {};
  }
  const claims: Record<string, unknown> = {};
  if (scopes.includes('profile')) {
    // A withheld claim is ABSENT, not null: null says "this person has no
    // picture", absent says "this app was not given one". Apps must treat both
    // as "show nothing" (docs/sign-in-with-orangecat says so).
    const withheld = new Set<string>(clientId ? await withheldClaimsFor(userId, clientId) : []);
    if (!withheld.has('name')) {
      claims.name = profile.name ?? null;
    }
    if (!withheld.has('preferred_username')) {
      claims.preferred_username = profile.username ?? null;
    }
    if (!withheld.has('picture')) {
      claims.picture = profile.avatar_url ?? null;
    }
  }
  if (scopes.includes('email')) {
    // The account holds the email. profiles.email is a copy taken at sign-up
    // and never follows a later add or change (an anonymous account adding its
    // email, a changed address), so it is only the fallback.
    const { data: account } = await adminDb().auth.admin.getUserById(userId);
    const accountEmail = account?.user?.email || null;
    claims.email = accountEmail ?? profile.email ?? null;
    claims.email_verified = accountEmail !== null && Boolean(account?.user?.email_confirmed_at);
  }
  return claims;
}
