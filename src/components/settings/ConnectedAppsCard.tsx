'use client';

/**
 * Connected apps — everything a person has let in through "Sign in with
 * OrangeCat", and one button to take each one back.
 *
 * Lives on Settings → Integrations beside integration keys: keys are how the
 * person's own tools authenticate to OrangeCat; connected apps are how OTHER
 * apps authenticate as the person. Both answer "who can act as me?".
 */

import { useEffect, useState } from 'react';
import { AppWindow, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormattedDate } from '@/components/ui/FormattedDate';
import { API_ROUTES } from '@/config/api-routes';
import { OAUTH_CLIENT_ORIGINS } from '@/lib/oauth/config';
import type { ConnectedApp } from '@/services/auth/connectedApps';
import { logger } from '@/utils/logger';

export default function ConnectedAppsCard() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_ROUTES.CONNECTED_APPS.BASE, { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`Failed to load connected apps (${res.status})`);
        }
        const json = (await res.json()) as { data: { apps: ConnectedApp[] } };
        if (!cancelled) {
          setApps(json.data?.apps ?? []);
          setLoading(false);
        }
      } catch (err) {
        logger.error('Failed to load connected apps', { err });
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load connected apps');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRevoke(app: ConnectedApp) {
    if (
      !window.confirm(
        `Disconnect ${app.name}? It will have to ask for your permission again before it can act as you.`
      )
    ) {
      return;
    }
    setRevoking(app.clientId);
    try {
      const res = await fetch(API_ROUTES.CONNECTED_APPS.BY_CLIENT(app.clientId), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Failed to disconnect (${res.status})`);
      }
      setApps(prev => prev.filter(a => a.clientId !== app.clientId));
      toast.success(`${app.name} disconnected`);
    } catch (err) {
      logger.error('Failed to revoke connected app', { err });
      toast.error(err instanceof Error ? err.message : 'Could not disconnect. Try again.');
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-fg-secondary">Loading connected apps…</p>;
  }
  if (error) {
    return <p className="text-sm text-status-negative">{error}</p>;
  }
  if (apps.length === 0) {
    return (
      <div className="rounded-lg border border-subtle bg-surface-raised/30 p-6 text-center">
        <AppWindow className="mx-auto mb-2 h-6 w-6 text-fg-tertiary" />
        <p className="text-sm text-fg-secondary">
          No app has signed in with your OrangeCat account yet. When one does, it appears here and
          you can disconnect it any time.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-subtle rounded-lg border border-subtle bg-surface-base">
      {apps.map(app => (
        <li key={app.clientId} className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-fg-primary">{app.name}</span>
              {app.registeredVia === OAUTH_CLIENT_ORIGINS.dcr && (
                <span
                  className="inline-flex items-center gap-1 rounded bg-status-warning-subtle px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-status-warning"
                  title="This app registered itself. Nobody at OrangeCat checked it."
                >
                  <ShieldAlert className="h-3 w-3" />
                  Unverified
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-secondary">
              <span>
                Can:{' '}
                <code className="rounded bg-surface-raised px-1">
                  {app.scopes.length ? app.scopes.join(', ') : 'sign you in'}
                </code>
              </span>
              <span>
                Connected <FormattedDate value={app.grantedAt} mode="date" />
              </span>
              <span>
                Last used{' '}
                {app.lastUsedAt ? (
                  <FormattedDate value={app.lastUsedAt} mode="datetime" />
                ) : (
                  'never'
                )}
              </span>
              <span>
                {app.liveSessions === 1 ? '1 live session' : `${app.liveSessions} live sessions`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleRevoke(app)}
            disabled={revoking === app.clientId}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-subtle px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-raised/60 hover:text-status-negative disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {revoking === app.clientId ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </li>
      ))}
    </ul>
  );
}
