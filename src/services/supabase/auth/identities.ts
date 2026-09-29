/**
 * Identities — the ways into this account at the auth server, and linking a
 * second one so that losing the inbox is not losing the account (ADR-0009, D6).
 *
 * Linking sends the person through the provider and back to /auth/callback
 * with `next` set to the settings page. The auth server must allow it
 * (GOTRUE_SECURITY_MANUAL_LINKING_ENABLED — docs/operations/account-recovery.md);
 * when it does not, the error is surfaced as is so the card can say so.
 */
import supabase from '@/lib/supabase/browser';
import { OAUTH_TO_SUPABASE, type OAuthProvider } from '@/app/auth/oauth-provider-map';
import { ROUTES } from '@/config/routes';
import { callbackUrl } from '@/lib/oauth/handoff';
import { describeIdentity, type SignInMethod } from '@/lib/auth/sign-in-methods';
import { logger } from '@/utils/logger';
import type { AuthError } from '../types';

export async function listSignInMethods(): Promise<{
  methods: SignInMethod[];
  error: AuthError | null;
}> {
  try {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      logger.auth('Failed to list identities', { error: error.message });
      return { methods: [], error: error as AuthError };
    }
    return { methods: (data?.identities ?? []).map(describeIdentity), error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error listing identities', { error: authError.message }, 'Auth');
    return { methods: [], error: authError };
  }
}

/** Start linking a provider. On success the browser navigates away. */
export async function linkProvider(provider: OAuthProvider): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.linkIdentity({
      provider: OAUTH_TO_SUPABASE[provider],
      // The same callback the sign-in flow uses, returning to Settings.
      options: { redirectTo: callbackUrl(window.location.origin, ROUTES.SETTINGS) },
    });
    if (error) {
      logger.auth('Failed to start linking', { provider, error: error.message });
      return { error: error as AuthError };
    }
    return { error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error linking identity', { error: authError.message }, 'Auth');
    return { error: authError };
  }
}

export async function unlinkMethod(method: SignInMethod): Promise<{ error: AuthError | null }> {
  try {
    const { data, error: listError } = await supabase.auth.getUserIdentities();
    const identity = data?.identities.find(i => i.identity_id === method.id);
    if (listError || !identity) {
      return { error: (listError ?? new Error('Identity not found')) as AuthError };
    }
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      logger.auth('Failed to unlink identity', { provider: method.provider, error: error.message });
      return { error: error as AuthError };
    }
    logger.auth('Identity unlinked', { provider: method.provider });
    return { error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error unlinking identity', { error: authError.message }, 'Auth');
    return { error: authError };
  }
}
