'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import supabase from '@/lib/supabase/browser';
import { ROUTES } from '@/config/routes';
import { AuthTitle } from '../AuthTitle';
import { BackToSignIn } from './BackToSignIn';

/**
 * Recovery via the 6-digit code the reset email always contains. This is the
 * cross-device path: the PKCE link only works in the browser that requested
 * the reset (it holds the code verifier), so a user opening the email on
 * another machine lands here instead of on a dead end.
 */
export function OtpForm({
  onVerified,
  onRequestNewReset,
}: {
  onVerified: () => void;
  onRequestNewReset: () => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      });
      if (error) {
        throw error;
      }
      onVerified();
    } catch (err: unknown) {
      const caught = err as { message?: string };
      setError(
        caught.message || 'That code did not work. Request a new reset email and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthTitle
        title="Enter your reset code"
        lede="Your reset email contains a 6-digit code. Enter it with your email address to continue."
      />

      {error && (
        <div className="oc-error-surface mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div className="ml-3">
              <p className="mb-0 text-sm font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Your email address"
          disabled={isLoading}
          className="h-12 w-full"
          autoComplete="email"
        />
        <Input
          label="6-digit code"
          type="text"
          required
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="From the reset email"
          disabled={isLoading}
          className="h-12 w-full"
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        <Button
          type="submit"
          variant="primary"
          className="h-12 w-full"
          disabled={isLoading || !email || !code}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying…
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        <Button onClick={onRequestNewReset} variant="outline" className="h-12 w-full">
          Send a new reset email
        </Button>
        <div className="text-center">
          <Link
            href={ROUTES.AUTH_NO_EMAIL}
            className="inline-flex min-h-11 items-center text-sm text-fg-secondary underline hover:text-fg-primary"
          >
            Can&apos;t get to your email?
          </Link>
        </div>
        <BackToSignIn />
      </div>
    </>
  );
}
