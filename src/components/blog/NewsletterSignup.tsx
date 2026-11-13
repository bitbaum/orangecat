'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface NewsletterSignupProps {
  /** Which surface captured the signup — stored for attribution. */
  source: string;
}

/**
 * Newsletter capture form. Posts to /api/newsletter/subscribe and renders the
 * full async state set (loading / success / error) — the previous box was a
 * bare input whose emails went nowhere.
 */
export default function NewsletterSignup({ source }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'loading') {
      return;
    }
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(API_ROUTES.NEWSLETTER_SUBSCRIBE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.success) {
        setStatus('success');
        return;
      }
      setErrorMessage(
        typeof payload?.error === 'string'
          ? payload.error
          : 'Could not subscribe right now. Please try again.'
      );
      setStatus('error');
    } catch {
      setErrorMessage('Network error — please check your connection and try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div
        className="flex items-center justify-center gap-2 py-2 text-status-positive"
        role="status"
      >
        <CheckCircle className="h-5 w-5" />
        <span className="font-medium">You&apos;re on the list.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* min-w-0 on the input: a flex item never shrinks below its intrinsic
          width (~268px at the forced 16px), which pushed Subscribe off a
          390px screen. */}
      <div className="flex gap-4">
        <input
          type="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="Enter your email"
          aria-label="Email address"
          disabled={status === 'loading'}
          className="min-w-0 flex-1 px-4 py-2 border border-strong bg-surface-base text-fg-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        <Button type="submit" variant="primary" size="sm" disabled={status === 'loading'}>
          {status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subscribing…
            </>
          ) : (
            'Subscribe'
          )}
        </Button>
      </div>
      {status === 'error' && (
        <p className="mt-3 text-sm text-status-negative" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
