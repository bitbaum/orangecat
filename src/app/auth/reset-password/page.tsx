'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import supabase from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { GRADIENTS } from '@/config/gradients';
import { ROUTES } from '@/config/routes';
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

  return (
    <div
      className={cn(GRADIENTS.pageBgSolid, 'min-h-screen flex items-center justify-center px-4')}
    >
      {step === 'loading' && (
        <Card className="max-w-md w-full p-8 shadow-sm">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-fg-primary mb-6" />
            <h2 className="text-xl font-semibold text-fg-primary mb-2">Verifying Reset Link</h2>
            <p className="text-fg-secondary">
              Please wait while we verify your password reset link...
            </p>
          </div>
        </Card>
      )}

      {step === 'error' && (
        <Card className="max-w-md w-full p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-negative-subtle mb-6">
              <AlertCircle className="h-8 w-8 text-status-negative" />
            </div>
            <h1 className="text-2xl font-bold text-fg-primary mb-3">Reset Link Invalid</h1>
            <p className="text-fg-secondary mb-6">{error}</p>
            <div className="space-y-3">
              <Button onClick={goToForgot} variant="primary" className="w-full">
                Request New Reset Link
              </Button>
              <Button onClick={goToLogin} variant="outline" className="w-full">
                Back to Login
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'otp' && (
        <OtpForm onVerified={() => setStep('reset')} onRequestNewReset={goToForgot} />
      )}

      {step === 'reset' && <NewPasswordForm onSuccess={() => setStep('success')} />}

      {step === 'success' && (
        <Card className="max-w-md w-full p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-positive-subtle mb-6">
              <CheckCircle2 className="h-8 w-8 text-status-positive" />
            </div>
            <h1 className="text-2xl font-bold text-fg-primary mb-3">
              Password Updated Successfully
            </h1>
            <p className="text-fg-secondary mb-6">
              {returnTo
                ? 'Your password has been updated and you are signed in.'
                : 'Your password has been updated. You can now sign in with your new password.'}
            </p>
            {returnTo ? (
              <Button onClick={continueToApp} variant="primary" className="w-full">
                Continue
              </Button>
            ) : (
              <Button onClick={goToLogin} variant="primary" className="w-full">
                Sign In Now
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
