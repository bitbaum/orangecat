'use client';

/**
 * The free pool, as it is right now — not "try again in a minute".
 *
 * Groq reports its remaining requests per day and tokens per minute on every
 * response; OpenRouter's free pool is a per-day cap that resets at 00:00 UTC.
 * This card shows both next to the user's own daily allowance, so "capacity
 * is maxed out" is a number with a reset time, not a shrug.
 *
 * It is read by the person paying nothing for the thing it describes, not by
 * whoever deploys it — so it says what the number means for them. Three lines
 * here used to be operator telemetry read aloud: "no request seen since the
 * last restart" (whose restart?), and a token-budget line quoting an 8.0k TPM
 * window and a 6.8k prompt cap, neither of which a user can act on.
 *
 * What each tile says is decided in services/cat/free-pool-status.ts (pure,
 * tested); this component fetches and renders. It no longer repeats "your own
 * allowance resets in …": the budget card above it on both pages says so.
 */
import { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import type { CatCapacityResponse } from '@/app/api/cat/capacity/route';
import { freePoolTiles } from '@/services/cat/free-pool-status';

export function SharedCapacityCard() {
  const [data, setData] = useState<CatCapacityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.CAT.CAPACITY, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        throw new Error('Could not read capacity');
      }
      setData(json.data as CatCapacityResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read capacity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const tiles = data ? freePoolTiles(data) : null;

  return (
    <section
      aria-labelledby="shared-capacity"
      className="rounded-lg border border-default bg-surface-base p-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-surface-raised p-2">
          <Gauge className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="shared-capacity"
              className="font-heading text-base font-semibold text-fg-primary"
            >
              Free pool right now
            </h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-medium text-fg-secondary hover:text-fg-primary disabled:opacity-60"
              aria-label="Refresh capacity"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
          <p className="mt-1 text-sm text-fg-secondary">
            The providers behind the free models, shared by everyone. Your own daily messages are
            counted separately, and your own key never draws on this.
          </p>

          {error && !data && <p className="mt-4 text-sm text-status-warning">{error}</p>}

          {tiles && (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {tiles.map(tile => (
                <div key={tile.id} className="rounded-md border border-default p-4">
                  <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
                    {tile.label}
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-fg-primary">{tile.value}</dd>
                  <dd className="text-xs text-fg-tertiary">{tile.detail}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
