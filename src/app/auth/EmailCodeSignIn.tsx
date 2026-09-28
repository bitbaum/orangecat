'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { TurnstileCaptcha } from '@/components/auth/TurnstileCaptcha';
import supabase from '@/lib/supabase/browser';
import { getMFAAssuranceLevel } from '@/services/supabase/auth';
import { API_ROUTES } from '@/config/api-routes';

/** Seconds before "send another code" unlocks — the server allows 3 per 15 minutes. */
const RESEND_AFTER_S = 45;

/**
 * Sign in or create an account with a six-digit code sent by email — no
 * password to invent, remember or reset.
 *
 * Step 1 asks for the email and has /api/auth/email-code mail a code. Step 2
 * takes the code and hands it to GoTrue (`verifyOtp`, type `email`, which
 * accepts it for a new account and an existing one alike). A session then
 * exists, and the sign-in page's existing redirect takes the person on to
 * wherever they were going — including back to Solon or Loki mid-login.
 * Accounts with two-factor authentication still get their second step.
 */
export function EmailCodeSignIn({
  initialEmail,
  clientId,
  captchaSiteKey,
  onBack,
  onNeedsSecondFactor,
}: {
  initialEmail: string;
  clientId: string | null;
  captchaSiteKey: string | undefined;
  onBack: () => void;
  onNeedsSecondFactor: () => void;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.AUTH.EMAIL_CODE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), client: clientId, captchaToken }),
      });
      if (res.status === 429) {
        throw new Error('Too many codes asked for. Wait a few minutes, then try again.');
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'We could not send a code. Try again.');
      }
      setStep('code');
      setCode('');
      setResendIn(RESEND_AFTER_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send a code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.replace(/\D/g, ''),
        type: 'email',
      });
      if (verifyError) {
        throw new Error(
          /expired|invalid/i.test(verifyError.message)
            ? 'That code is wrong or has expired. Check the latest email, or send a new code.'
            : 'We could not check that code. Try again.'
        );
      }
      // Same second step the password sign-in enforces.
      const mfa = await getMFAAssuranceLevel();
      if (mfa.data?.currentLevel === 'aal1' && mfa.data?.nextLevel === 'aal2') {
        onNeedsSecondFactor();
      }
      // Otherwise the new session is picked up by AuthProvider and the page's
      // redirect effect sends the person on; nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not check that code. Try again.');
      setBusy(false);
    }
  };

  const needsCaptcha = !!captchaSiteKey;
  const digits = code.replace(/\D/g, '');

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={step === 'code' ? () => setStep('email') : onBack}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {step === 'code' ? 'Use a different email' : 'Use a password instead'}
      </button>

      {error && (
        <p role="alert" className="rounded-lg oc-error-surface p-3 text-sm text-status-negative">
          {error}
        </p>
      )}

      {step === 'email' ? (
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <div>
            <label htmlFor="code-email" className="mb-2 block text-sm font-medium text-fg-primary">
              Email
            </label>
            <Input
              id="code-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
              placeholder="you@example.org"
              autoComplete="email"
              inputMode="email"
              required
              className="h-12 w-full"
            />
            <p className="mt-2 text-xs text-fg-tertiary">
              We email you a six-digit code. New here? The code creates your account.
            </p>
          </div>
          {needsCaptcha && (
            <TurnstileCaptcha
              siteKey={captchaSiteKey}
              onSuccess={setCaptchaToken}
              onError={() => setCaptchaToken(null)}
              onExpire={() => setCaptchaToken(null)}
              theme="light"
            />
          )}
          <Button
            type="submit"
            variant="accent"
            disabled={busy || !email.trim() || (needsCaptcha && !captchaToken)}
            className="h-12 w-full font-semibold"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Email me a code'}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            void verifyCode();
          }}
        >
          <div className="flex items-start gap-3 rounded-lg border border-default p-3 text-sm text-fg-secondary">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">
              We sent a code to <strong className="text-fg-primary">{email.trim()}</strong>. It can
              take a minute; check spam if it does not arrive.
            </span>
          </div>
          <div>
            <label htmlFor="code-digits" className="mb-2 block text-sm font-medium text-fg-primary">
              Code
            </label>
            <Input
              id="code-digits"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={busy}
              placeholder="123456"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={12}
              required
              autoFocus
              className="h-12 w-full text-center font-mono text-xl tracking-widest"
            />
          </div>
          <Button
            type="submit"
            variant="accent"
            disabled={busy || digits.length < 6}
            className="h-12 w-full font-semibold"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
          </Button>
          <button
            type="button"
            // A CAPTCHA token is single-use: with CAPTCHA on, a new code means
            // a new challenge, which lives on the email step.
            onClick={
              needsCaptcha
                ? () => {
                    setCaptchaToken(null);
                    setStep('email');
                  }
                : () => void sendCode()
            }
            disabled={busy || resendIn > 0}
            className="min-h-11 w-full text-sm text-fg-secondary transition-colors hover:text-fg-primary disabled:opacity-50"
          >
            {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
          </button>
        </form>
      )}
    </div>
  );
}
