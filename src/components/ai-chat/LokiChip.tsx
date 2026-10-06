'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Hammer, X } from 'lucide-react';
import { ECOSYSTEM } from '@/config/ecosystem';
import { API_ROUTES } from '@/config/api-routes';
import { askCat } from '@/lib/chat/cat-send-event';
import { cn } from '@/lib/utils';
import type { CatConnectionStatus } from '@/services/cat/connections';

/**
 * Loki, visible from the Cat chat.
 *
 * The Cat could already hand work to Loki — build a site, hand over a
 * project, send one task to several projects — and nothing in the chat said
 * so: the capability lived in a settings list nobody opens while chatting. This
 * pill sits in the chat's own toolbar, says whether this account is linked to
 * Loki (and how many projects it has there), and opens a short sheet: what to
 * ask, one tap to ask it, and a way into Loki itself.
 */

/** What to ask, in the words that trigger it. Tapping sends it to the Cat. */
const EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: 'Send one task to several projects',
    prompt: 'Send this to my Loki projects orangecat and loki: ',
  },
  { label: 'Build a website', prompt: 'Build me a website for this project' },
  { label: 'Hand a project to Loki', prompt: 'Send this project to Loki to build' },
];

type LokiStatus = Pick<CatConnectionStatus, 'state' | 'detail' | 'connect'> | null;

export function LokiChip() {
  const [status, setStatus] = useState<LokiStatus>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch(API_ROUTES.CAT.CONNECTIONS)
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const loki = (body?.data?.connections as CatConnectionStatus[] | undefined)?.find(
          c => c.id === 'loki'
        );
        if (live && loki) {
          setStatus({ state: loki.state, detail: loki.detail, connect: loki.connect });
        }
      })
      .catch(() => {
        /* the pill still opens; it just cannot say whether you are linked */
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const linked = status?.state === 'connected';
  const notLinked = status?.state === 'not_connected';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-10 items-center gap-1.5 rounded-full border border-subtle px-3 text-sm text-fg-secondary transition-colors hover:border-default hover:text-fg-primary"
        title={linked ? `Loki · ${status?.detail ?? 'connected'}` : 'What the Cat can do with Loki'}
      >
        <Hammer className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span>Loki</span>
        {status && (
          <span
            className={cn(
              'h-2 w-2 flex-shrink-0 rounded-full',
              linked ? 'bg-status-positive' : 'border border-strong'
            )}
            aria-label={linked ? 'connected' : notLinked ? 'not connected' : 'status unknown'}
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Loki"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-default bg-surface-overlay p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-fg-primary">Loki builds what you ask for</p>
              <p className="mt-0.5 text-sm text-fg-secondary">
                {linked
                  ? `Linked${status?.detail ? ` · ${status.detail}` : ''}. Ask the Cat and it hands the work to your agents there.`
                  : notLinked
                    ? 'Not linked yet. Sign in to Loki with this OrangeCat account once, then ask here.'
                    : 'Ask the Cat and it hands the work to AI agents on Loki.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-1">
            {EXAMPLES.map(ex => (
              <li key={ex.label}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    askCat(ex.prompt);
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm text-fg-primary transition-colors hover:bg-surface-raised"
                >
                  <span>{ex.label}</span>
                  <span className="text-xs text-fg-tertiary">Ask</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            {notLinked && status?.connect && (
              <a
                href={status.connect.href}
                className="inline-flex min-h-10 items-center rounded-full bg-accent-warm px-4 text-sm font-medium text-on-accent"
              >
                Connect Loki
              </a>
            )}
            <a
              href={ECOSYSTEM.loki.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-default px-4 text-sm text-fg-primary hover:bg-surface-raised"
            >
              Open Loki <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
