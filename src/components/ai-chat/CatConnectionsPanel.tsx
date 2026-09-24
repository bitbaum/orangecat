'use client';

/**
 * Connections — what Cat is plugged into, and whether it is for you.
 *
 * Renders config/cat-connections with this user's status. Each row says what
 * the connection lets Cat SEE and DO in plain terms, because "connected" means
 * nothing to someone who does not know what it changes.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_ROUTES } from '@/config/api-routes';
import type { CatConnectionState, CatConnectionStatus } from '@/services/cat/connections';

const STATE_LABEL: Record<CatConnectionState, string> = {
  connected: 'Connected',
  not_connected: 'Not connected',
  everyone: 'On for everyone',
  unknown: 'Status unavailable',
};

export function CatConnectionsPanel() {
  const [connections, setConnections] = useState<CatConnectionStatus[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_ROUTES.CAT.CONNECTIONS, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(data => setConnections(data?.data?.connections ?? []))
      .catch(e => {
        if ((e as { name?: string }).name !== 'AbortError') {
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div
      id="connections"
      className="overflow-hidden rounded-md border border-subtle bg-surface-page"
    >
      <div className="flex items-center gap-2 border-b border-subtle bg-surface-raised/50 px-4 py-3">
        <Plug className="h-4 w-4 text-fg-secondary" />
        <span className="text-sm font-semibold text-fg-primary">Connections</span>
      </div>

      {failed ? (
        <p className="p-4 text-sm text-fg-secondary">
          Couldn&apos;t load connections. Try again in a moment.
        </p>
      ) : !connections ? (
        <div className="space-y-2 p-4" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-surface-raised" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {connections.map(c => (
            <li key={c.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg-primary">{c.name}</p>
                  <p className="text-xs text-fg-secondary">{c.purpose}</p>
                </div>
                <span
                  className={cn(
                    'flex-shrink-0 rounded-full border px-2 py-0.5 text-xs',
                    c.state === 'connected'
                      ? 'border-status-positive/30 bg-status-positive-subtle text-status-positive'
                      : 'border-subtle text-fg-secondary'
                  )}
                >
                  {STATE_LABEL[c.state]}
                  {c.detail ? ` · ${c.detail}` : ''}
                </span>
              </div>

              {c.reads.length > 0 && (
                <ul className="space-y-0.5 text-xs text-fg-secondary">
                  {c.reads.map(r => (
                    <li key={r}>Cat sees: {r}</li>
                  ))}
                </ul>
              )}

              {c.state === 'not_connected' &&
                (c.connect.external ? (
                  <a
                    href={c.connect.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center justify-between rounded-md border border-subtle px-3 py-2 text-sm text-fg-primary transition-colors hover:bg-surface-raised"
                  >
                    {c.connect.label}
                    <ArrowUpRight className="h-4 w-4 text-fg-tertiary" />
                  </a>
                ) : (
                  <Link
                    href={c.connect.href}
                    className="flex min-h-11 items-center justify-between rounded-md border border-subtle px-3 py-2 text-sm text-fg-primary transition-colors hover:bg-surface-raised"
                  >
                    {c.connect.label}
                    <ChevronRight className="h-4 w-4 text-fg-tertiary" />
                  </Link>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
