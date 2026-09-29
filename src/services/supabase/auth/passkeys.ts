/**
 * Passkeys (WebAuthn) — a sign-in with nothing to type and nothing to leak.
 *
 * The browser client does the whole ceremony (challenge → navigator.credentials
 * → verify); these wrappers add the logging and the { data, error } shape the
 * rest of the auth service uses. The server must have passkeys switched on
 * (lib/auth/passkeys-availability) or every call here fails.
 */
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type { AuthError } from '../types';

export interface PasskeyRow {
  id: string;
  friendlyName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** True where this browser can create and use passkeys at all. */
export function browserSupportsPasskeys(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

export async function listPasskeys(): Promise<{ passkeys: PasskeyRow[]; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      logger.auth('Failed to list passkeys', { error: error.message });
      return { passkeys: [], error: error as AuthError };
    }
    return {
      passkeys: (data ?? []).map(p => ({
        id: p.id,
        friendlyName: p.friendly_name ?? null,
        createdAt: p.created_at,
        lastUsedAt: p.last_used_at ?? null,
      })),
      error: null,
    };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error listing passkeys', { error: authError.message }, 'Auth');
    return { passkeys: [], error: authError };
  }
}

/**
 * Create a passkey for the signed-in person and name it. The name is set in a
 * second call because the ceremony itself takes none; a failed rename still
 * leaves a working, unnamed passkey.
 */
export async function addPasskey(
  friendlyName: string
): Promise<{ passkey: PasskeyRow | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.registerPasskey();
    if (error || !data) {
      logger.auth('Passkey registration failed', { error: error?.message });
      return {
        passkey: null,
        error: (error ?? new Error('Passkey registration failed')) as AuthError,
      };
    }
    const name = friendlyName.trim().slice(0, 120);
    let named = data.friendly_name ?? null;
    if (name) {
      const renamed = await supabase.auth.passkey.update({
        passkeyId: data.id,
        friendlyName: name,
      });
      if (renamed.error) {
        logger.auth('Passkey created but not named', { error: renamed.error.message });
      } else {
        named = renamed.data?.friendly_name ?? name;
      }
    }
    logger.auth('Passkey registered', { passkeyId: data.id });
    return {
      passkey: { id: data.id, friendlyName: named, createdAt: data.created_at, lastUsedAt: null },
      error: null,
    };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error registering passkey', { error: authError.message }, 'Auth');
    return { passkey: null, error: authError };
  }
}

export async function removePasskey(passkeyId: string): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    if (error) {
      logger.auth('Failed to remove passkey', { error: error.message });
      return { error: error as AuthError };
    }
    logger.auth('Passkey removed', { passkeyId });
    return { error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error removing passkey', { error: authError.message }, 'Auth');
    return { error: authError };
  }
}

/** Sign in with a passkey. On success the client holds the session, like any other sign-in. */
export async function signInWithPasskey(): Promise<{ success: boolean; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPasskey();
    if (error || !data?.session) {
      logger.auth('Passkey sign-in failed', { error: error?.message });
      return { success: false, error: (error ?? new Error('Passkey sign-in failed')) as AuthError };
    }
    logger.auth('Passkey sign-in succeeded', { userId: data.user?.id });
    return { success: true, error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error signing in with passkey', { error: authError.message }, 'Auth');
    return { success: false, error: authError };
  }
}
