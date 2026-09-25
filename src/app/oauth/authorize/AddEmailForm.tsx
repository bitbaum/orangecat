'use client';

/**
 * An anonymous OrangeCat account asked to sign in to another app.
 *
 * The other app needs an account it can attribute, so we ask for an email
 * here, in the flow, rather than sending the person to Settings and hoping
 * they find their way back. GoTrue converts the anonymous user in place; if it
 * wants the address confirmed first, the link in that email returns through
 * /auth/callback to this same authorize request.
 */
import { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import supabase from '@/lib/supabase/browser';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { callbackUrl } from '@/lib/oauth/handoff';

export function AddEmailForm({ clientName, returnTo }: { clientName: string; returnTo: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: callbackUrl(window.location.origin, returnTo) }
      );
      if (updateError) {
        throw updateError;
      }
      if (data.user && !data.user.is_anonymous) {
        // Converted on the spot — carry on to the app.
        window.location.assign(returnTo);
        return;
      }
      setState('sent');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add that email. Try again.'));
      setState('idle');
    }
  };

  const startOver = async () => {
    await fetch('/auth/signout', { method: 'POST' });
    window.location.assign(`/auth?from=${encodeURIComponent(returnTo)}`);
  };

  if (state === 'sent') {
    return (
      <div className="oc-surface oc-surface-padding rounded-card">
        <h1 className="text-xl font-semibold text-fg-primary">Check your inbox</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          We sent a link to <span className="text-fg-primary">{email}</span>. Open it and you will
          continue straight to {clientName}.
        </p>
      </div>
    );
  }

  return (
    <div className="oc-surface oc-surface-padding rounded-card">
      <h1 className="text-xl font-semibold text-fg-primary">
        Add your email to continue to <span className="text-accent-warm">{clientName}</span>
      </h1>
      <p className="mt-2 text-sm text-fg-secondary">
        You have been exploring without an email. {clientName} needs one to know it is you next
        time. Everything you did so far stays on this account.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label htmlFor="add-email" className="block text-sm font-medium text-fg-primary">
          Email address
        </label>
        <Input
          id="add-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={state === 'sending'}
        />
        {error && (
          <p role="alert" className="text-sm text-status-negative">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={state === 'sending' || !email}>
          {state === 'sending' ? 'Adding…' : `Continue to ${clientName}`}
        </Button>
      </form>
      <button
        type="button"
        onClick={startOver}
        className="mt-4 text-sm text-fg-secondary underline underline-offset-4 hover:text-fg-primary"
      >
        Use a different account instead
      </button>
    </div>
  );
}
