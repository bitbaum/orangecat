import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { signInAnonymously } from '@/services/supabase/auth';
import { getReadableError } from '@/utils/getReadableError';
import supabase from '@/lib/supabase/browser';
import { useAuthSubmission } from './useAuthSubmission';
import type { Provider } from '@supabase/supabase-js';
import { OAUTH_TO_SUPABASE, type OAuthProvider } from './oauth-provider-map';
import { safeReturnPath } from '@/lib/navigation/safe-return-path';

export type { OAuthProvider };

export type AuthMode = 'login' | 'register' | 'forgot';

export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export function useAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, isLoading: authLoading, hydrated, session, profile, clear } = useAuth();

  const [mode, setMode] = useState<AuthMode>(() => {
    const modeParam = searchParams?.get('mode');
    return modeParam === 'login' || modeParam === 'register' ? modeParam : 'login';
  });

  useEffect(() => {
    const modeParam = searchParams?.get('mode');
    if (modeParam === 'login' || modeParam === 'register') {
      setMode(modeParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (hydrated && !session && !profile) {
      clear();
    }
  }, [hydrated, session, profile, clear]);

  // The OAuth callback at /auth/callback/route.ts redirects back to
  // /auth?error=... when exchangeCodeForSession fails. Without consuming
  // the param here, the user lands on a clean-looking sign-in form with
  // no explanation of why their Google/GitHub/X attempt didn't work.
  // Surface the URL error into the on-page error pin (same surface that
  // displays submission errors) and strip it from the URL so a manual
  // refresh doesn't keep replaying it.
  const [urlError, setUrlError] = useState<string | null>(null);
  useEffect(() => {
    const errParam = searchParams?.get('error');
    if (errParam) {
      setUrlError(errParam);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams]);

  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showMFAVerify, setShowMFAVerify] = useState(false);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaEnabled = !!turnstileSiteKey;

  const handleCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaError = useCallback((_err: string) => {
    setCaptchaToken(null);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  const {
    localLoading,
    error,
    success,
    retryCount,
    handleSubmit,
    handleForgotPassword,
    handleRetry: submissionRetry,
    handleClearError: submissionClearError,
  } = useAuthSubmission({
    formData,
    mode,
    captchaEnabled,
    captchaToken,
    setCaptchaToken,
    setMode,
    setShowMFAVerify,
    rememberMe,
    signIn,
    signUp,
  });

  const loading = localLoading || authLoading;
  // This hook owns the post-auth redirect below because it must preserve the
  // exact validated `from` path. The generic redirect hook always targets the
  // dashboard and would race this effect, intermittently discarding intent.
  const _isCurrentlyLoading = loading;

  // Wrap submission's retry/clear so the URL-error layer clears too —
  // otherwise hitting Retry on a callback-surfaced error leaves it
  // pinned even after the next attempt succeeds.
  const handleRetry = useCallback(() => {
    setUrlError(null);
    submissionRetry();
  }, [submissionRetry]);
  const handleClearError = useCallback(() => {
    setUrlError(null);
    submissionClearError();
  }, [submissionClearError]);

  useEffect(() => {
    if (session?.user && hydrated) {
      const redirectUrl = safeReturnPath(searchParams?.get('from'));
      router.replace(redirectUrl);
    }
  }, [session, hydrated, router, searchParams]);

  const handleMFAVerificationComplete = () => {
    setShowMFAVerify(false);
  };

  const handleMFACancelled = () => {
    setShowMFAVerify(false);
    clear();
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        // Map app id → GoTrue/supabase key (X is `twitter`, LinkedIn is
        // `linkedin_oidc`). Cast to supabase-js's own Provider union derived
        // from the map (SSOT) rather than a hardcoded list.
        provider: OAUTH_TO_SUPABASE[provider] as Provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            safeReturnPath(searchParams?.get('from'), '/dashboard/cat')
          )}`,
        },
      });
      if (error) {
        throw error;
      }
    } catch (err) {
      // OAuth can fail when the provider is misconfigured, the user
      // cancels the popup, or the redirect URL is wrong. Same silent
      // swallow pattern as anonymous sign-in — surface to the user.
      const message = getReadableError(err, `Failed to sign in with ${provider}`);
      toast.error(message);
    }
  };

  const handleAnonymousSignIn = async () => {
    try {
      const result = await signInAnonymously();
      if (result.error) {
        throw new Error(getReadableError(result.error, 'Anonymous sign-in failed'));
      }
      const redirectUrl = safeReturnPath(searchParams?.get('from'));
      router.replace(redirectUrl);
    } catch (err) {
      // Surface the failure: anonymous sign-in can fail for environment
      // reasons (provider disabled in Supabase, captcha required, rate
      // limit). The previous handler swallowed the error to the console
      // only, leaving the user staring at a spinner that silently reset.
      const message = getReadableError(err, 'Anonymous sign-in failed');
      toast.error(message);
    }
  };

  return {
    mode,
    setMode,
    formData,
    setFormData,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    loading,
    error: error || urlError,
    success,
    rememberMe,
    setRememberMe,
    isPasswordFocused,
    setIsPasswordFocused,
    showMFAVerify,
    session,
    hydrated,
    captchaToken,
    captchaEnabled,
    turnstileSiteKey,
    handleCaptchaSuccess,
    handleCaptchaError,
    handleCaptchaExpire,
    handleSubmit,
    handleForgotPassword,
    handleRetry,
    handleClearError,
    handleMFAVerificationComplete,
    handleMFACancelled,
    handleOAuthSignIn,
    handleAnonymousSignIn,
    _isCurrentlyLoading,
    retryCount,
  };
}
