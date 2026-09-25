'use client';

/**
 * WHAT CAT CAN SEE — Cat's connections as one scannable list.
 *
 * One row per connection: a status dot, the name, ONE line of status. The
 * detail (what Cat sees through it, what it lets Cat do, connect/disconnect)
 * opens on tap. The old panel printed all of it for every row, three
 * "Cat sees:" lines each, so the list read as a wall of text and the one
 * thing you came for — is it connected? — was a small pill at the far edge.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatConnectionLink } from '@/config/cat-connections';
import { CAT_ACTIONS } from '@/config/cat-actions';
import type { CatConnectionStatus } from '@/services/cat/connections';

const STATE: Record<CatConnectionStatus['state'], { label: string; dot: string }> = {
  connected: { label: 'Connected', dot: 'bg-status-positive' },
  limited: { label: 'Public only', dot: 'bg-status-warning' },
  everyone: { label: 'On for everyone', dot: 'bg-status-positive' },
  not_connected: { label: 'Not connected', dot: 'border border-strong bg-transparent' },
  unknown: { label: 'Status unavailable', dot: 'bg-fg-tertiary' },
};

/** What came back from GitHub's approval screen (see the GitHub callback route). */
const GITHUB_OUTCOME: Record<string, { text: string; ok: boolean }> = {
  connected: { text: 'GitHub connected — Cat can now see the repositories you chose.', ok: true },
  denied: { text: 'GitHub was not connected — you declined on GitHub.', ok: false },
  failed: { text: 'GitHub could not be connected. Please try again.', ok: false },
};

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-subtle px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised';

function ConnectLink({ link }: { link: CatConnectionLink }) {
  if (link.kind === 'page') {
    return (
      <Link href={link.href} className={BUTTON}>
        {link.label}
      </Link>
    );
  }
  // `redirect` is a full page load through our API (an OAuth start);
  // `external` opens the other product in a new tab.
  const external = link.kind === 'external';
  return (
    <a
      href={link.href}
      className={BUTTON}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {link.label}
      {external && <ArrowUpRight className="h-4 w-4 text-fg-tertiary" />}
    </a>
  );
}

function statusLine(c: CatConnectionStatus): string {
  return c.detail ? `${STATE[c.state].label} · ${c.detail}` : STATE[c.state].label;
}

interface SeesSectionProps {
  connections: CatConnectionStatus[] | null;
  failed: boolean;
  onChanged: () => void;
}

export function SeesSection({ connections, failed, onChanged }: SeesSectionProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const outcome = GITHUB_OUTCOME[useSearchParams()?.get('github') ?? ''];

  const disconnect = async (c: CatConnectionStatus) => {
    if (!c.disconnectEndpoint) {
      return;
    }
    setBusy(c.id);
    try {
      await fetch(c.disconnectEndpoint, { method: 'DELETE' });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  if (failed) {
    return (
      <p className="text-sm text-fg-secondary">
        Couldn&apos;t load connections. Try again in a moment.
      </p>
    );
  }
  if (!connections) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-raised" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {outcome && (
        <p
          role="status"
          className={cn('text-sm', outcome.ok ? 'text-status-positive' : 'text-fg-secondary')}
        >
          {outcome.text}
        </p>
      )}

      <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-default bg-surface-base">
        {connections.map(c => {
          const isOpen = open === c.id;
          const actionNames = c.actions
            .map(a => CAT_ACTIONS[a]?.name)
            .filter((n): n is string => !!n);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : c.id)}
                aria-expanded={isOpen}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised/60 sm:px-5"
              >
                <span
                  className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', STATE[c.state].dot)}
                />
                <span className="w-28 flex-shrink-0 text-sm font-medium text-fg-primary sm:w-36">
                  {c.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                  {statusLine(c)}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 flex-shrink-0 text-fg-tertiary transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="space-y-4 px-4 pb-5 sm:px-5 sm:pl-[3.25rem]">
                  <p className="text-sm text-fg-primary">{c.purpose}</p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                        Cat sees
                      </dt>
                      <dd>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-fg-secondary">
                          {c.reads.map(r => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    {actionNames.length > 0 && (
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                          Cat can
                        </dt>
                        <dd>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-fg-secondary">
                            {actionNames.map(n => (
                              <li key={n}>{n}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {c.offerConnect && c.connectHint && c.connect.kind === 'redirect' && (
                    <p className="rounded-md bg-surface-raised px-3 py-2 text-sm text-fg-secondary">
                      {c.connectHint}
                    </p>
                  )}
                  {(c.offerConnect || c.disconnectEndpoint) && (
                    <div className="flex flex-wrap items-center gap-3">
                      {c.offerConnect && <ConnectLink link={c.connect} />}
                      {c.disconnectEndpoint && (
                        <button
                          type="button"
                          onClick={() => void disconnect(c)}
                          disabled={busy === c.id}
                          className="min-h-11 text-sm text-fg-secondary underline-offset-2 hover:text-fg-primary hover:underline disabled:opacity-50"
                        >
                          {busy === c.id ? 'Disconnecting…' : `Disconnect ${c.name}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
