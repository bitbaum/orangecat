'use client';

/**
 * Ways to sign in — Settings → Security. Every identity at the auth server
 * (email, and each linked provider), a button to link another, and remove,
 * refused while it would leave the person with no way in. The second way in
 * is what makes losing the inbox survivable (ADR-0009, D6).
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Mail, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormattedDate } from '@/components/ui/FormattedDate';
import { OAUTH_PROVIDERS } from '@/app/auth/OAuthIcons';
import type { OAuthProvider } from '@/app/auth/oauth-provider-map';
import { API_ROUTES } from '@/config/api-routes';
import {
  linkableProviders,
  methodLabel,
  unlinkBlocker,
  type SignInMethod,
} from '@/lib/auth/sign-in-methods';
import {
  linkProvider,
  listPasskeys,
  listSignInMethods,
  unlinkMethod,
} from '@/services/supabase/auth';

const PROVIDER_NAMES = Object.fromEntries(OAUTH_PROVIDERS.map(p => [p.id, p.name]));
const PROVIDER_ICONS = Object.fromEntries(OAUTH_PROVIDERS.map(p => [p.id, p.icon]));

export function SignInMethodsCard() {
  const [methods, setMethods] = useState<SignInMethod[]>([]);
  const [passkeyCount, setPasskeyCount] = useState(0);
  const [available, setAvailable] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ methods: rows, error: listError }, { passkeys }, providersRes] = await Promise.all([
        listSignInMethods(),
        listPasskeys().catch(() => ({ passkeys: [] })),
        fetch(API_ROUTES.AUTH.OAUTH_PROVIDERS)
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (cancelled) {
        return;
      }
      if (listError) {
        setError('Could not load your sign-in methods. Reload to try again.');
      }
      setMethods(rows);
      setPasskeyCount(passkeys.length);
      setAvailable((providersRes?.data?.providers as OAuthProvider[] | undefined) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLink(provider: OAuthProvider) {
    setBusy(provider);
    setError(null);
    const { error: linkError } = await linkProvider(provider);
    if (linkError) {
      setError(
        /manual linking/i.test(linkError.message)
          ? 'Linking another account is not switched on yet. Ask support to enable it.'
          : `Could not start linking ${PROVIDER_NAMES[provider]}. Try again.`
      );
      setBusy(null);
    }
    // On success the browser has navigated to the provider.
  }

  async function handleUnlink(method: SignInMethod) {
    const label = methodLabel(method, PROVIDER_NAMES);
    if (!window.confirm(`Remove ${label} as a way to sign in?`)) {
      return;
    }
    setBusy(method.id);
    setError(null);
    const { error: unlinkError } = await unlinkMethod(method);
    if (unlinkError) {
      setError(`Could not remove ${label}. Try again.`);
    } else {
      setMethods(prev => prev.filter(m => m.id !== method.id));
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

  const onlyOneWayIn = methods.length + passkeyCount < 2;
  const linkable = linkableProviders(methods, available);

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-subtle rounded-lg border border-subtle">
        {methods.map(method => {
          const Icon = method.oauthProvider ? PROVIDER_ICONS[method.oauthProvider] : Mail;
          const blocker = unlinkBlocker(method, methods, passkeyCount);
          return (
            <li key={method.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-fg-secondary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg-primary">
                    {methodLabel(method, PROVIDER_NAMES)}
                    {method.handle && (
                      <span className="ml-2 font-normal text-fg-secondary">{method.handle}</span>
                    )}
                  </p>
                  <p className="text-xs text-fg-secondary">
                    {method.lastSignInAt ? (
                      <>
                        Last used <FormattedDate value={method.lastSignInAt} mode="date" />
                      </>
                    ) : (
                      'Never used to sign in'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUnlink(method)}
                disabled={busy === method.id || blocker !== null}
                title={blocker ?? `Remove ${methodLabel(method, PROVIDER_NAMES)}`}
                aria-label={`Remove ${methodLabel(method, PROVIDER_NAMES)}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-fg-secondary hover:text-status-negative disabled:opacity-40"
              >
                {busy === method.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          );
        })}
        {passkeyCount > 0 && (
          <li className="p-3 text-sm text-fg-secondary">
            {passkeyCount === 1 ? '1 passkey' : `${passkeyCount} passkeys`} (managed above)
          </li>
        )}
      </ul>

      {onlyOneWayIn && (
        <p className="text-sm text-status-warning">
          Only one way in. If you lose it, only support can get you back. Add a second one.
        </p>
      )}

      {linkable.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkable.map(provider => {
            const Icon = PROVIDER_ICONS[provider];
            return (
              <Button
                key={provider}
                variant="outline"
                size="sm"
                disabled={busy === provider}
                onClick={() => handleLink(provider)}
              >
                {busy === provider ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    <Icon className="mr-2 h-4 w-4" />
                    Link {PROVIDER_NAMES[provider]}
                  </>
                )}
              </Button>
            );
          })}
        </div>
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
