'use client';

/**
 * Passkeys on Settings → Security: the ones this person has, one button to add
 * another, one to remove each. Rendered only when the auth server has passkeys
 * switched on (the parent checks), and it says so plainly when this browser
 * cannot make one.
 */
import { useEffect, useState } from 'react';
import { KeyRound, Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormattedDate } from '@/components/ui/FormattedDate';
import {
  addPasskey,
  browserSupportsPasskeys,
  listPasskeys,
  removePasskey,
} from '@/services/supabase/auth';
import type { PasskeyRow } from '@/services/supabase/auth/passkeys';

function defaultName(): string {
  if (typeof navigator === 'undefined') {
    return 'This device';
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) {
    return 'iPhone or iPad';
  }
  if (/Android/.test(ua)) {
    return 'Android phone';
  }
  if (/Mac/.test(ua)) {
    return 'Mac';
  }
  if (/Windows/.test(ua)) {
    return 'Windows PC';
  }
  if (/Linux/.test(ua)) {
    return 'Linux computer';
  }
  return 'This device';
}

export function PasskeysCard() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = browserSupportsPasskeys();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { passkeys: rows, error: listError } = await listPasskeys();
      if (cancelled) {
        return;
      }
      if (listError) {
        setError('Could not load your passkeys. Reload to try again.');
      }
      setPasskeys(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    setBusy('add');
    setError(null);
    const { passkey, error: addError } = await addPasskey(name || defaultName());
    if (addError || !passkey) {
      setError(
        /cancel|abort|not allowed/i.test(addError?.message ?? '')
          ? 'No passkey was created. You can try again any time.'
          : 'Could not create a passkey on this device. Try again, or use another sign-in method.'
      );
    } else {
      setPasskeys(prev => [passkey, ...prev]);
      setAdding(false);
      setName('');
    }
    setBusy(null);
  }

  async function handleRemove(row: PasskeyRow) {
    if (
      !window.confirm(
        `Remove the passkey "${row.friendlyName ?? 'Unnamed'}"? You will not be able to sign in with it any more.`
      )
    ) {
      return;
    }
    setBusy(row.id);
    setError(null);
    const { error: removeError } = await removePasskey(row.id);
    if (removeError) {
      setError('Could not remove that passkey. Try again.');
    } else {
      setPasskeys(prev => prev.filter(p => p.id !== row.id));
    }
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-fg-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {passkeys.length === 0 ? (
        <p className="text-sm text-fg-secondary">
          No passkeys yet. A passkey signs you in with your face, fingerprint or device PIN. There
          is nothing to remember and nothing that can be phished.
        </p>
      ) : (
        <ul className="divide-y divide-subtle rounded-lg border border-subtle">
          {passkeys.map(row => (
            <li key={row.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <KeyRound className="h-4 w-4 shrink-0 text-fg-secondary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg-primary">
                    {row.friendlyName ?? 'Unnamed passkey'}
                  </p>
                  <p className="text-xs text-fg-secondary">
                    Added <FormattedDate value={row.createdAt} mode="date" />
                    {row.lastUsedAt && (
                      <>
                        {' · '}last used <FormattedDate value={row.lastUsedAt} mode="date" />
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(row)}
                disabled={busy === row.id}
                aria-label={`Remove passkey ${row.friendlyName ?? ''}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-fg-secondary hover:text-status-negative disabled:opacity-50"
              >
                {busy === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!supported ? (
        <p className="text-xs text-fg-secondary">
          This browser cannot create passkeys. Try a current browser on a phone or a computer with a
          fingerprint reader, face unlock or PIN.
        </p>
      ) : adding ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={e => {
            e.preventDefault();
            void handleAdd();
          }}
        >
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={defaultName()}
            aria-label="Passkey name"
            maxLength={120}
            className="h-11 flex-1"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="accent" disabled={busy === 'add'} className="h-11">
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create passkey'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                setAdding(false);
                setName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add a passkey
        </Button>
      )}

      {error && (
        <div className="oc-error-surface flex items-center gap-2 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-status-negative" />
          <p className="text-sm text-status-negative/80">{error}</p>
        </div>
      )}
    </div>
  );
}
