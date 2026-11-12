/**
 * Auth Operations - Sign in, sign up, sign out, password management
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { ROUTES } from '@/config/routes';
import type {
  AuthResponse,
  SignInRequest,
  SignUpRequest,
  PasswordResetRequest,
  PasswordUpdateRequest,
  AuthError,
} from '../types';
import { handleAuthError } from './errors';

/**
 * The one clock a slow auth call has. Settles with `work`, or rejects with
 * `message` (which handleAuthError reads as a timeout) after `ms`. The sign-in
 * form keeps no timer of its own: this rejection is what ends its spinner.
 */
async function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function signIn({ email, password }: SignInRequest): Promise<AuthResponse> {
  try {
    logger.auth('Attempting to sign in user', { email });

    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      20000,
      'Authentication request timed out'
    );

    if (error) {
      const enhancedError = handleAuthError(error, 'sign in');
      logger.auth('Sign in failed', { email, error: enhancedError.message });
      return { data: { user: null, session: null }, error: enhancedError };
    }

    logger.auth('Sign in successful', { email, userId: data.user?.id, hasSession: !!data.session });
    return { data, error: null };
  } catch (error) {
    const enhancedError = handleAuthError(error, 'sign in');
    logger.error(
      'Unexpected error during sign in',
      { email, error: enhancedError.message },
      'Auth'
    );
    return { data: { user: null, session: null }, error: enhancedError };
  }
}

export async function signUp({
  email,
  password,
  emailRedirectTo,
}: SignUpRequest): Promise<AuthResponse> {
  try {
    logger.auth('Attempting to sign up user', { email });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.orangecat.ch';

    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectTo || `${siteUrl}/auth/callback`,
        },
      }),
      25000,
      'Registration request timed out'
    );

    if (error) {
      const enhancedError = handleAuthError(error, 'sign up');
      logger.auth('Sign up failed', { email, error: enhancedError.message });
      return { data: { user: null, session: null }, error: enhancedError };
    }

    logger.auth('Sign up successful', {
      email,
      userId: data.user?.id,
      needsConfirmation: !data.session,
    });
    return { data, error: null };
  } catch (error) {
    const enhancedError = handleAuthError(error, 'sign up');
    logger.error(
      'Unexpected error during sign up',
      { email, error: enhancedError.message },
      'Auth'
    );
    return { data: { user: null, session: null }, error: enhancedError };
  }
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    logger.auth('Attempting to sign out user');
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.auth('Sign out failed', { error: error.message });
      return { error: error as AuthError };
    }

    // The browser client now uses the @supabase/ssr cookie adapter, so signOut()
    // above clears the CURRENT session's cookies. This extra call is belt-and-
    // suspenders: the route deletes EVERY sb-*/supabase/auth cookie regardless of
    // project ref, so it also sweeps stale orphans the client doesn't know about
    // (e.g. cookies left from the managed-cloud→self-host ref change) that would
    // otherwise keep bloating the Cookie header toward a 431. Best-effort; never blocks.
    try {
      await fetch(ROUTES.AUTH_SIGNOUT, { method: 'POST', credentials: 'same-origin' });
    } catch (cookieClearError) {
      logger.warn('Sign out: failed to clear server cookies', { error: cookieClearError }, 'Auth');
    }

    logger.auth('Sign out successful');
    return { error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error during sign out', { error: authError.message }, 'Auth');
    return { error: authError };
  }
}

export async function resetPassword({
  email,
}: PasswordResetRequest): Promise<{ error: AuthError | null }> {
  try {
    logger.auth('Attempting password reset', { email });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.orangecat.ch';
    const redirectUrl = `${siteUrl}/auth/reset-password`;

    logger.auth('Using redirect URL for password reset', { redirectUrl });

    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl }),
      20000,
      'Password reset request timed out'
    );

    if (error) {
      const enhancedError = handleAuthError(error, 'password reset');
      logger.auth('Password reset failed', { email, error: enhancedError.message });
      return { error: enhancedError };
    }

    logger.auth('Password reset email sent successfully', { email, redirectUrl });
    return { error: null };
  } catch (error) {
    const enhancedError = handleAuthError(error, 'password reset');
    logger.error('Unexpected error during password reset', { error: enhancedError.message, email });
    return { error: enhancedError };
  }
}

export async function updatePassword({
  newPassword,
}: PasswordUpdateRequest): Promise<{ error: AuthError | null }> {
  try {
    logger.auth('Attempting password update');

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      logger.auth('Password update failed', { error: error.message });
      return { error: error as AuthError };
    }

    logger.auth('Password updated successfully');
    return { error: null };
  } catch (error) {
    const authError = error as AuthError;
    logger.error('Unexpected error during password update', { error: authError.message }, 'Auth');
    return { error: authError };
  }
}

// NOTE: Anonymous sign-in requires "Allow anonymous sign-ins" to be enabled
// in Supabase Dashboard > Authentication > Providers > Anonymous
export async function signInAnonymously(): Promise<AuthResponse> {
  try {
    logger.auth('Attempting anonymous sign-in');

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      const enhancedError = handleAuthError(error, 'anonymous sign-in');
      logger.auth('Anonymous sign-in failed', { error: enhancedError.message });
      return { data: { user: null, session: null }, error: enhancedError };
    }

    logger.auth('Anonymous sign-in successful', { userId: data.user?.id });
    return { data, error: null };
  } catch (error) {
    const enhancedError = handleAuthError(error, 'anonymous sign-in');
    logger.error(
      'Unexpected error during anonymous sign-in',
      { error: enhancedError.message },
      'Auth'
    );
    return { data: { user: null, session: null }, error: enhancedError };
  }
}

export async function resendConfirmationEmail(): Promise<{ error: AuthError | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      logger.auth('Cannot resend confirmation - no user email', { error: userError?.message });
      return { error: { message: 'No user email found', name: 'ResendError' } as AuthError };
    }

    logger.auth('Attempting to resend confirmation email', { email: user.email });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.orangecat.ch';

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      logger.auth('Resend confirmation failed', { email: user.email, error: error.message });
      return { error: error as AuthError };
    }

    logger.auth('Confirmation email resent successfully', { email: user.email });
    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unexpected error resending confirmation', { error: errorMessage });
    return { error: { message: errorMessage, name: 'ResendError' } as AuthError };
  }
}
