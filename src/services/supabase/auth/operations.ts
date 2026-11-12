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

export async function signIn({ email, password }: SignInRequest): Promise<AuthResponse> {
  try {
    logger.auth('Attempting to sign in user', { email });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Authentication request timed out')), 20000);
    });

    const authPromise = supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await Promise.race([authPromise, timeoutPromise]);

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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Registration request timed out')), 25000);
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.orangecat.ch';

    const authPromise = supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectTo || `${siteUrl}/auth/callback`,
      },
    });

    const { data, error } = await Promise.race([authPromise, timeoutPromise]);

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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      logger.auth('Password reset failed', { email, error: error.message });
      return { error };
    }

    logger.auth('Password reset email sent successfully', { email, redirectUrl });
    return { error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unexpected error during password reset', { error: errorMessage, email });
    return { error: { message: errorMessage, name: 'ResetError' } as AuthError };
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
export async function signInAnonymously(captchaToken?: string | null): Promise<AuthResponse> {
  try {
    logger.auth('Attempting anonymous sign-in');

    // The captcha travels with it, as with every other sign-in: a
    // pseudonymous account gets the free daily allowance, so an account
    // made by a script multiplies it (2026-11-12 audit).
    const { data, error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined
    );

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
