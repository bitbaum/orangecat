'use client';

/**
 * The free pool, as it is right now — not "try again in a minute".
 *
 * Groq reports its remaining requests per day and tokens per minute on every
 * response; OpenRouter's free pool is a per-day cap that resets at 00:00 UTC.
 * This card shows both next to the user's own daily allowance, so "capacity
 * is maxed out" is a number with a reset time, not a shrug.
 */
import { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import type { CatCapacityResponse } from '@/app/api/cat/capacity/route';

function formatCountdown(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function compact(n: number | null): string {
  if (n == null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function SharedCapacityCard() {
  const [data, setData] = useState<CatCapacityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.CAT.CAPACITY, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) throw new Error('Could not read capacity');
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

  const groq = data?.groq.models.find(m => m.model === data.promptBudget.model) ?? null;
  const obs = groq?.observation ?? null;

  return (
    <section
      aria-labelledby="shared-capacity"
      className="rounded-lg border border-default bg-surface-base p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-surface-raised p-2">
            <Gauge className="h-5 w-5 text-fg-primary" />
          </div>
          <div>
            <h2 id="shared-capacity" className="text-lg font-semibold text-fg-primary">
              Free pool right now
            </h2>
            <p className="mt-1 text-sm text-fg-secondary">
              Shared by everyone on OrangeCat&apos;s own keys. Your own daily allowance is separate;
              your own key is never counted here.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary hover:text-fg-primary disabled:opacity-60"
          aria-label="Refresh capacity"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && !data && <p className="mt-4 text-sm text-status-warning">{error}</p>}

      {data && (
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-default p-4">
            <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
              Groq · today
            </dt>
            <dd className="mt-1 text-lg font-semibold text-fg-primary">
              {obs ? `${compact(obs.remainingRequests)} / ${compact(obs.limitRequests)}` : '—'}
            </dd>
            <dd className="text-xs text-fg-tertiary">
              {obs
                ? `requests left · resets in ${formatCountdown(obs.resetRequestsSeconds)}`
                : data.groq.configured
                  ? 'no request seen since the last restart'
                  : 'not configured'}
            </dd>
          </div>
          <div className="rounded-md border border-default p-4">
            <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
              Groq · this minute
            </dt>
            <dd className="mt-1 text-lg font-semibold text-fg-primary">
              {obs ? `${compact(obs.remainingTokens)} / ${compact(obs.limitTokens)}` : '—'}
            </dd>
            <dd className="text-xs text-fg-tertiary">
              tokens · one request may use up to {compact(data.promptBudget.tpmLimit)}; Cat builds
              its prompt to {compact(data.promptBudget.budgetTokens)} so a reply fits
            </dd>
          </div>
          <div className="rounded-md border border-default p-4">
            <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
              OpenRouter · free models
            </dt>
            <dd className="mt-1 text-lg font-semibold text-fg-primary">
              {!data.openrouter.configured
                ? '—'
                : data.openrouter.freeDailyCapHitAt
                  ? 'Daily cap hit'
                  : 'Available'}
            </dd>
            <dd className="text-xs text-fg-tertiary">
              {data.openrouter.freeResetsAt
                ? `resets ${new Date(data.openrouter.freeResetsAt).toUTCString().slice(17, 22)} UTC`
                : data.openrouter.configured
                  ? 'the fallback when Groq is out'
                  : 'not configured'}
            </dd>
          </div>
        </dl>
      )}

      {data && (
        <p className="mt-4 text-xs text-fg-tertiary">
          You: {data.quota.requestsRemaining} of {data.quota.dailyLimit} messages left today ·
          resets in {formatCountdown(data.quota.resetInSeconds)}.
        </p>
      )}
    </section>
  );
}
