'use client';

/**
 * The one decision on the accept page: an address, and Accept. On success the
 * tab reloads as the account that is now theirs.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { API_ROUTES } from '@/config/api-routes';
import { IDENTITIES_COPY } from '@/config/identities';
import { ROUTES } from '@/config/routes';
import { readIdentityError } from '@/lib/identities/client';

export function AcceptHandoverForm({
  token,
  signedInElsewhere,
}: {
  token: string;
  /** This browser already has a session, which accepting replaces. */
  signedInElsewhere: boolean;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Accepted, but this browser could not be signed in to it: the address to use. */
  const [doneAs, setDoneAs] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.IDENTITIES.HANDOVER_ACCEPT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      });
      if (!res.ok) {
        setError(await readIdentityError(res, IDENTITIES_COPY.acceptFailed));
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { data?: { signedIn?: boolean } };
      if (body.data?.signedIn) {
        window.location.assign(ROUTES.DASHBOARD.HOME);
        return;
      }
      // It is theirs, but this browser is not in it (it may still be in
      // another account). Say so here; sending them anywhere would land them
      // in whatever account the browser already had, with no word it worked.
      setDoneAs(email.trim());
      setBusy(false);
    } catch {
      setError(IDENTITIES_COPY.acceptFailed);
      setBusy(false);
    }
  };

  if (doneAs) {
    return (
      <div className="mt-6 space-y-4" role="status">
        <h2 className="text-lg font-semibold text-fg-primary">{IDENTITIES_COPY.acceptDoneTitle}</h2>
        <p className="mb-0 text-fg-secondary">{IDENTITIES_COPY.acceptDoneSignIn(doneAs)}</p>
        <Button
          type="button"
          className="min-h-11 w-full"
          onClick={() => window.location.assign(ROUTES.AUTH)}
        >
          {IDENTITIES_COPY.acceptDoneSignInButton}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Input
        type="email"
        label={IDENTITIES_COPY.acceptEmailLabel}
        description={IDENTITIES_COPY.acceptEmailNote}
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        required
        error={error ?? undefined}
      />
      {signedInElsewhere && (
        <p className="mb-0 text-sm text-fg-secondary">{IDENTITIES_COPY.acceptSignedInNote}</p>
      )}
      <Button type="submit" className="min-h-11 w-full" disabled={busy || !email.trim()}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {IDENTITIES_COPY.acceptButton}
      </Button>
    </form>
  );
}
