'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Key, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import supabase from '@/lib/supabase/browser';
import { ROUTES } from '@/config/routes';

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
    <Card className="max-w-md w-full p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-surface-base border border-default mb-6">
          <Key className="h-8 w-8 text-fg-primary" />
        </div>
        <h1 className="text-2xl font-bold text-fg-primary mb-2">Enter Your Reset Code</h1>
        <p className="text-fg-secondary">
          Your reset email contains a 6-digit code — enter it with your email address to continue.
        </p>
      </div>

      {error && (
        <div className="oc-error-surface mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Your email address"
          disabled={isLoading}
          className="w-full"
          autoComplete="email"
        />
        <Input
          type="text"
          required
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="6-digit code from the email"
          disabled={isLoading}
          className="w-full"
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
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
        <Button onClick={onRequestNewReset} variant="outline" className="w-full">
          Request New Reset Email
        </Button>
        <div className="text-center">
          <Link
            href={ROUTES.AUTH_NO_EMAIL}
            className="text-sm text-fg-secondary underline hover:text-fg-primary"
          >
            Can&apos;t get to your email?
          </Link>
        </div>
        <div className="text-center">
          <Link
            href={`${ROUTES.AUTH}?mode=login`}
            className="inline-flex items-center text-sm text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Link>
        </div>
      </div>
    </Card>
  );
}
