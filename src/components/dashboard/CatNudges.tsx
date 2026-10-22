'use client';

/**
 * "From your Cat" — proactive, grounded suggestions the Cat generates in the
 * background (activation, connection, completion). Fetched from /api/cat/nudges;
 * dismissible. Renders nothing when there are no nudges.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';
import { DashboardSection } from '@/components/dashboard/sections/DashboardSection';
import { NUDGE_POLICY } from '@/services/cat/nudge-policy';
import { API_ROUTES } from '@/config/api-routes';

interface Nudge {
  id: string;
  nudge_type: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
}

// At most three arrive, already chosen by the server's nudge-policy: one per
// kind, never a dismissed one, and fewer of a kind you keep dismissing. Four
// full cards used to fill two phone screens, which is how a suggestion
// becomes wallpaper.

export function CatNudges() {
  const [nudges, setNudges] = useState<Nudge[] | null>(null);
  // A quiet acknowledgement after a hide, so dismissing reads as being heard.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetch(API_ROUTES.CAT.NUDGES)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (on && d?.success) {
          setNudges((d.data?.nudges || []).slice(0, NUDGE_POLICY.maxShown));
        }
      })
      .catch(() => {
        if (on) {
          setNudges([]);
        }
      });
    return () => {
      on = false;
    };
  }, []);

  const dismiss = (id: string) => {
    // Optimistically remove, but restore on failure so the nudge doesn't silently
    // reappear on next load (the dismissal wasn't persisted).
    const removed = nudges?.find(nudge => nudge.id === id);
    const index = nudges?.findIndex(nudge => nudge.id === id) ?? 0;
    setNudges(n => n?.filter(x => x.id !== id) ?? null);
    setNotice(null);
    fetch(API_ROUTES.CAT.NUDGES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', id }),
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to dismiss (${res.status})`);
        }
        setNotice('Suggestion hidden.');
      })
      .catch(() => {
        if (removed) {
          setNudges(current => {
            if (current?.some(nudge => nudge.id === removed.id)) {
              return current;
            }
            const restored = [...(current ?? [])];
            restored.splice(Math.min(index, restored.length), 0, removed);
            return restored;
          });
        }
        setNotice("Couldn't hide this suggestion. Try again.");
      });
  };

  if (!nudges || nudges.length === 0) {
    return notice ? (
      <p className="text-sm text-fg-tertiary" role="status">
        {notice}
      </p>
    ) : null;
  }

  return (
    <DashboardSection id="dashboard-cat-suggests" title="Your Cat suggests">
      <ul className="divide-y divide-subtle rounded-lg border border-default bg-surface-base">
        {nudges.map(n => (
          <li key={n.id} className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-fg-primary">{n.title}</p>
              <p className="mt-1 break-words text-sm text-fg-secondary">{n.body}</p>
              {n.cta_url && n.cta_label && (
                <Link
                  href={n.cta_url}
                  className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1 text-sm font-semibold text-fg-primary hover:underline"
                >
                  <span className="break-words text-left">{n.cta_label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label={`Hide: ${n.title}`}
              title="Hide. Hide two of a kind and your Cat stops suggesting it for a month."
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {notice && (
        <p className="mt-1 text-xs text-fg-tertiary" role="status">
          {notice}
        </p>
      )}
    </DashboardSection>
  );
}

export default CatNudges;
