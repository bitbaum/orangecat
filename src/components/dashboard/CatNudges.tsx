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
import { API_ROUTES } from '@/config/api-routes';

interface Nudge {
  id: string;
  nudge_type: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
}

// The Cat's proactive suggestions, highest confidence first (the API's
// order). Four are kept; three show, the fourth behind "Show 1 more". Four
// full cards with a paragraph each filled two phone screens, which is how a
// suggestion becomes wallpaper.
const DASHBOARD_NUDGE_CAP = 4;
const DASHBOARD_NUDGE_VISIBLE = 3;

export function CatNudges() {
  const [nudges, setNudges] = useState<Nudge[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let on = true;
    fetch(API_ROUTES.CAT.NUDGES)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (on && d?.success) {
          setNudges((d.data?.nudges || []).slice(0, DASHBOARD_NUDGE_CAP));
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
    const prev = nudges;
    setNudges(n => n?.filter(x => x.id !== id) ?? null);
    fetch(API_ROUTES.CAT.NUDGES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', id }),
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to dismiss (${res.status})`);
        }
      })
      .catch(() => {
        setNudges(prev);
      });
  };

  if (!nudges || nudges.length === 0) {
    return null;
  }

  const shown = showAll ? nudges : nudges.slice(0, DASHBOARD_NUDGE_VISIBLE);
  const hidden = nudges.length - shown.length;

  return (
    <DashboardSection id="dashboard-cat-suggests" title="Your Cat suggests">
      <ul className="divide-y divide-subtle rounded-lg border border-default bg-surface-base">
        {shown.map(n => (
          <li key={n.id} className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg-primary">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-fg-secondary">{n.body}</p>
              {n.cta_url && n.cta_label && (
                <Link
                  href={n.cta_url}
                  className="mt-1 inline-flex min-h-9 max-w-full items-center gap-1 text-sm font-semibold text-fg-primary hover:underline"
                >
                  <span className="truncate">{n.cta_label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label={`Dismiss: ${n.title}`}
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-1 min-h-11 text-sm font-medium text-fg-secondary hover:text-fg-primary"
        >
          Show {hidden} more
        </button>
      )}
    </DashboardSection>
  );
}

export default CatNudges;
