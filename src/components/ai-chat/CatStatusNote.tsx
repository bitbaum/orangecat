'use client';

import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, Key, Loader2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { useCatHealth } from '@/hooks/useCatHealth';
import type { CatHealthReport } from '@/services/cat/health-probes';

/**
 * Renders an "AI temporarily unavailable" note when a live health probe says
 * Cat can't answer. Renders nothing while healthy or un-probed — so a result
 * that is genuinely empty (not an outage) stays quiet and isn't misattributed
 * to the user. Used wherever an empty state could be masking an LLM outage.
 */
export function CatStatusNote({ health }: { health: CatHealthReport | null }) {
  const router = useRouter();
  if (!health || health.catCanAnswer) {
    return null;
  }
  return (
    <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-4 text-left">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-primary">
            Cat&apos;s AI is temporarily unavailable
          </p>
          <p className="mt-1 text-xs text-fg-secondary">{health.summary}</p>
          <button
            type="button"
            onClick={() => router.push(ROUTES.SETTINGS_AI)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-warm px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-warm/90"
          >
            <Key className="h-3.5 w-3.5" />
            Add your own free key
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Self-probing "Check Cat's status" button — for the moment a chat send fails,
 * where the user most needs to know whether Cat is down. Runs the probe on
 * click (never automatically) and shows the human-readable summary inline.
 * This is what makes the diagnose endpoint reachable when Cat itself is down.
 */
export function CatStatusButton() {
  const { health, isProbing, probe } = useCatHealth();
  return (
    <>
      <button
        type="button"
        onClick={() => void probe()}
        disabled={isProbing}
        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline disabled:opacity-60"
      >
        {isProbing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        Check Cat&apos;s status
      </button>
      {health && (
        <p
          className={cn(
            'mt-1 w-full text-xs',
            health.catCanAnswer ? 'text-status-positive' : 'text-status-warning'
          )}
        >
          {health.summary}
        </p>
      )}
    </>
  );
}
