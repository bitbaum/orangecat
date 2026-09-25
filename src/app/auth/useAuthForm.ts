import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth, useRedirectIfAuthenticated } from '@/hooks/useAuth';
import { signInAnonymously } from '@/services/supabase/auth';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import supabase from '@/lib/supabase/browser';
import { useAuthSubmission } from './useAuthSubmission';
import type { Provider } from '@supabase/supabase-js';
import { OAUTH_TO_SUPABASE, type OAuthProvider } from './oauth-provider-map';
import { callbackUrl, readHandoff } from '@/lib/oauth/handoff';

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
  const { isLoading: redirectLoading } = useRedirectIfAuthenticated();

  const [mode, setMode] = useState<AuthMode>(() => {
    const modeParam = searchParams?.get('mode');
    // 'forgot' included: /auth?mode=forgot is a linkable entry (reset emails,
    // support replies) — dropping it silently showed the login form instead.
    return modeParam === 'login' || modeParam === 'register' || modeParam === 'forgot'
      ? modeParam
      : 'login';
  });

  useEffect(() => {
    const modeParam = searchParams?.get('mode');
    if (modeParam === 'login' || modeParam === 'register' || modeParam === 'forgot') {
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

  // What another app asked for on the person's behalf (lib/oauth/handoff.ts).
  const handoff = readHandoff({ get: name => searchParams?.get(name) ?? null });

  const [formData, setFormData] = useState<AuthFormData>({
    email: handoff.email ?? '',
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
  const _isCurrentlyLoading = loading || redirectLoading;

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
    if (!(session?.user && hydrated)) {
      return;
    }
    const fromParam = searchParams?.get('from') || '/dashboard';
    // Same-origin paths only — `from` is attacker-suppliable via the URL.
    const redirectUrl =
      fromParam.startsWith('/') && !fromParam.startsWith('//') ? fromParam : '/dashboard';
    router.replace(redirectUrl);
    // The soft replace can race the server's view of the fresh auth cookie
    // (e.g. right after anonymous sign-in): middleware 307s back to /auth,
    // this page renders the "Welcome back!" spinner, and nothing ever retries
    // — an eternal spinner even though the session exists. A hard navigation
    // after a grace period re-runs the server pass with the cookies as they
    // are NOW, which settles it.
    const fallback = setTimeout(() => {
      if (window.location.pathname.startsWith('/auth')) {
        window.location.assign(redirectUrl);
      }
    }, 2500);
    return () => clearTimeout(fallback);
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
        // Carry `from` through the provider round trip, or a person who
        // started on Solon lands on OrangeCat's welcome page instead.
        options: {
          redirectTo: callbackUrl(window.location.origin, searchParams?.get('from') ?? null),
        },
      });
      if (error) {
        throw error;
      }
    } catch (err) {
      // OAuth can fail when the provider is misconfigured, the user
      // cancels the popup, or the redirect URL is wrong. Same silent
      // swallow pattern as anonymous sign-in — surface to the user.
      const message = apiErrorMessage(err, `Failed to sign in with ${provider}`);
      toast.error(message);
    }
  };

  // They already chose Google/GitHub/… on the other app's screen: go there
  // directly instead of making them choose again. Once per page load.
  const providerStarted = useRef(false);
  useEffect(() => {
    if (!hydrated || session || providerStarted.current || !handoff.provider) {
      return;
    }
    providerStarted.current = true;
    void handleOAuthSignIn(handoff.provider);
    // handleOAuthSignIn is recreated each render; the ref makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session, handoff.provider]);

  const handleAnonymousSignIn = async () => {
    try {
      const result = await signInAnonymously();
      if (result.error) {
        throw new Error(apiErrorMessage(result.error, 'Anonymous sign-in failed'));
      }
      // Same-origin paths only — `from` is attacker-suppliable via the URL.
      // The session branch above already guards this; without the same check
      // here, anonymous sign-in was an open redirect.
      const anonFrom = searchParams?.get('from') || '/dashboard';
      const redirectUrl =
        anonFrom.startsWith('/') && !anonFrom.startsWith('//') ? anonFrom : '/dashboard';
      router.replace(redirectUrl);
    } catch (err) {
      // Surface the failure: anonymous sign-in can fail for environment
      // reasons (provider disabled in Supabase, captcha required, rate
      // limit). The previous handler swallowed the error to the console
      // only, leaving the user staring at a spinner that silently reset.
      const message = apiErrorMessage(err, 'Anonymous sign-in failed');
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
