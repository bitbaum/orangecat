'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import supabase from '@/lib/supabase/browser';
import { ROUTES } from '@/config/routes';
import { AuthStepPage, AuthTitle } from '../AuthTitle';
import { CLEAR_RETURN_COOKIE, returnPathFromCookies } from '@/lib/oauth/handoff';
import { OtpForm } from './OtpForm';
import { NewPasswordForm } from './NewPasswordForm';

type Step = 'loading' | 'reset' | 'otp' | 'success' | 'error';

/**
 * Password-recovery landing page. Three ways in, all of which must work:
 *  - legacy implicit-flow links (`type=recovery` + access/refresh tokens)
 *  - PKCE-flow links (`?code=`), which only exchange in the browser that
 *    requested the reset — cross-device arrivals fall through to…
 *  - the 6-digit code the reset email always contains (OtpForm).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  // The app they were signing in to when they asked for the reset (see
  // returnCookie in lib/oauth/handoff.ts). Null on another device.
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    setReturnTo(returnPathFromCookies(document.cookie));
  }, []);

  useEffect(() => {
    // Supabase v2 may deliver tokens via hash fragment. Merge hash into search params if present.
    const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
    const hashParams = new URLSearchParams(url?.hash.startsWith('#') ? url.hash.substring(1) : '');

    const qp = searchParams || new URLSearchParams();
    const accessToken = qp.get('access_token') || hashParams.get('access_token');
    const refreshToken = qp.get('refresh_token') || hashParams.get('refresh_token');
    const type = qp.get('type') || hashParams.get('type');
    const code = qp.get('code');

    if (type === 'recovery' && accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setStep('error');
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else {
            setStep('reset');
          }
        });
    } else if (code) {
      // The browser client runs with detectSessionInUrl, so by the time this
      // effect fires it has usually ALREADY exchanged the code and cleaned the
      // URL — getSession() awaits that. A second manual exchange would consume
      // nothing (the code is single-use) and throw, wrongly dropping the user
      // to the OTP form. Only exchange manually if no session materialized.
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          setStep('reset');
          return;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStep('otp');
          setError(null);
        } else {
          setStep('reset');
        }
      });
    } else {
      setStep('otp');
    }
  }, [searchParams]);

  const goToLogin = () => router.push(ROUTES.AUTH_LOGIN);
  // A finished reset leaves them signed in, so going back to where they were
  // headed (usually another app's /oauth/authorize) completes that sign-in.
  const continueToApp = () => {
    document.cookie = CLEAR_RETURN_COOKIE;
    window.location.assign(returnTo ?? ROUTES.AUTH_LOGIN);
  };
  const goToForgot = () => router.push(ROUTES.AUTH_FORGOT_PASSWORD);

  // Every step in the frame of /auth itself: one centred title block, no
  // card, no icon tile, sentence case — the same place, not three others.
  return (
    <AuthStepPage>
      {step === 'loading' && (
        <div className="text-center" role="status">
          <Loader2 className="mx-auto mb-6 h-8 w-8 animate-spin text-fg-secondary" />
          <AuthTitle title="Checking your reset link" lede="This takes a moment." />
        </div>
      )}

      {step === 'error' && (
        <>
          <AuthTitle title="This reset link no longer works" lede={error ?? undefined} />
          <div className="space-y-3">
            <Button onClick={goToForgot} variant="primary" className="h-12 w-full">
              Send a new reset email
            </Button>
            <Button onClick={goToLogin} variant="outline" className="h-12 w-full">
              Back to sign in
            </Button>
          </div>
        </>
      )}

      {step === 'otp' && (
        <OtpForm onVerified={() => setStep('reset')} onRequestNewReset={goToForgot} />
      )}

      {step === 'reset' && <NewPasswordForm onSuccess={() => setStep('success')} />}

      {step === 'success' && (
        <>
          <AuthTitle
            title="Password updated"
            lede={
              returnTo
                ? 'You are signed in with your new password.'
                : 'Sign in with your new password.'
            }
          />
          {returnTo ? (
            <Button onClick={continueToApp} variant="primary" className="h-12 w-full">
              Continue
            </Button>
          ) : (
            <Button onClick={goToLogin} variant="primary" className="h-12 w-full">
              Sign in
            </Button>
          )}
        </>
      )}
    </AuthStepPage>
  );
}
