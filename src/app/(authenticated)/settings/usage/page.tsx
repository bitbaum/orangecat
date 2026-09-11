'use client';

/**
 * Settings → Usage — the one page that answers "how much AI do I have left,
 * what counts against it, and when does it reset?" in a single glance.
 *
 * Everything here was ALREADY computed server-side and returned by
 * GET /api/cat/quota (resetInSeconds, dailyRequests, expiresAt) and
 * GET /api/cat/credits (balanceBtc) — it just was never rendered anywhere,
 * leaving the tiny chat-toolbar chip as the only quota surface. This page
 * composes those two existing endpoints; no new backend.
 */

import Link from 'next/link';
import { SharedCapacityCard } from '@/components/ai/SharedCapacityCard';
import { Gauge, KeyRound, Sparkles, Wallet } from 'lucide-react';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useCatQuota } from '@/components/ai-chat/ModernChatPanel/hooks/useCatQuota';
import { ROUTES } from '@/config/routes';
import { CAT_PLANS, PLAN_ID_BY_QUOTA_TIER, type CatPlanId } from '@/config/cat-plans';
import { formatCountdown, useCreditBalance } from './useCreditBalance';
import { APP_LOCALE } from '@/utils/locale';

export default function UsageSettingsPage() {
  const { quota, isLoading: quotaLoading } = useCatQuota();
  const { balanceBtc, error: creditError, retry: retryCredits } = useCreditBalance();
  const { formatAmountBtc } = useDisplayCurrency();

  /** Which CAT_PLANS card is the user's current reality — via the SSOT map. */
  const activePlanId: CatPlanId | null = quota ? PLAN_ID_BY_QUOTA_TIER[quota.tier] : null;

  const used = quota ? quota.dailyRequests : 0;
  const limit = quota ? quota.dailyLimit : 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* ── Today's budget ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-default bg-surface-base p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-surface-raised p-2">
            <Gauge className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold text-fg-primary">
              Today&apos;s Cat budget
            </h2>
            {quotaLoading ? (
              <p className="mt-2 text-sm text-fg-tertiary">Loading your usage…</p>
            ) : !quota ? (
              <p className="mt-2 text-sm text-fg-tertiary">
                Couldn&apos;t load your usage right now — the chat itself still works. Refresh to
                try again.
              </p>
            ) : quota.tier === 'byok' ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-fg-secondary">
                  <KeyRound className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                  You&apos;re on your own key
                  {quota.activeByokProviderName ? ` (${quota.activeByokProviderName})` : ''} —{' '}
                  <span className="font-medium text-fg-primary">no daily cap</span>. You pay your
                  provider directly; OrangeCat never marks it up.
                </p>
                <p className="text-sm text-fg-tertiary">
                  Remove your key in{' '}
                  <Link href={ROUTES.SETTINGS_AI} className="underline underline-offset-2">
                    AI settings
                  </Link>{' '}
                  and you fall back to the free daily budget below.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-semibold text-fg-primary">
                    {quota.requestsRemaining}
                  </span>
                  <span className="text-sm text-fg-secondary">
                    of {limit} messages left today
                    {quota.tier === 'pro' && (
                      <>
                        {' '}
                        <Sparkles
                          className="inline h-3.5 w-3.5 text-accent-warm"
                          aria-hidden="true"
                        />{' '}
                        Supporter
                      </>
                    )}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
                  role="progressbar"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={limit}
                  aria-label={`${used} of ${limit} daily messages used`}
                >
                  <div
                    className={
                      quota.requestsRemaining <= 0
                        ? 'h-full rounded-full bg-status-negative'
                        : quota.requestsRemaining <= 2
                          ? 'h-full rounded-full bg-status-warning'
                          : 'h-full rounded-full bg-accent-warm'
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-sm text-fg-tertiary">
                  Used {used} today · resets in{' '}
                  <span className="font-medium text-fg-secondary">
                    {formatCountdown(quota.resetInSeconds)}
                  </span>{' '}
                  (midnight UTC)
                  {quota.tier === 'pro' && quota.expiresAt && (
                    <>
                      {' '}
                      · Supporter until{' '}
                      {new Date(quota.expiresAt).toLocaleDateString(APP_LOCALE, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SharedCapacityCard />

      {/* ── What counts ────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-default bg-surface-base p-6">
        <h2 className="font-heading text-base font-semibold text-fg-primary">What counts</h2>
        <ul className="mt-3 space-y-2 text-sm text-fg-secondary">
          <li>• Every message you send to Cat on the free or Supporter plan counts as 1.</li>
          <li>
            • Messages sent through your own API key don&apos;t touch this budget — your provider
            bills you directly.
          </li>
          <li>
            • Frontier-model messages paid with Cat Credits are metered per message from your credit
            balance, not from the daily budget.
          </li>
          <li>• Image generation is free and doesn&apos;t count.</li>
          <li>
            • The counter resets every day at midnight UTC. Unused messages don&apos;t roll over.
          </li>
        </ul>
      </section>

      {/* ── Cat Credits ────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-default bg-surface-base p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-surface-raised p-2">
            <Wallet className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold text-fg-primary">Cat Credits</h2>
            {creditError ? (
              <div className="oc-error-surface mt-2">
                <p className="text-sm">Couldn&apos;t load your credit balance.</p>
                <button
                  type="button"
                  onClick={retryCredits}
                  className="mt-2 text-sm font-medium underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-fg-secondary">
                {balanceBtc !== null ? (
                  <>
                    Balance:{' '}
                    <span className="font-medium text-fg-primary">
                      {formatAmountBtc(balanceBtc)}
                    </span>
                  </>
                ) : (
                  'Prepaid balance for managed frontier models, billed per message.'
                )}
              </p>
            )}
            <p className="mt-1 text-sm text-fg-tertiary">
              Top up and see the per-message ledger in{' '}
              <Link href={ROUTES.SETTINGS_AI} className="underline underline-offset-2">
                AI settings
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── Plans at a glance ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-default bg-surface-base p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-base font-semibold text-fg-primary">
            Your plan options
          </h2>
          <Link
            href={ROUTES.PRICING}
            className="text-sm text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
          >
            Full comparison →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border-subtle">
          {CAT_PLANS.map(plan => {
            const isActive = plan.id === activePlanId;
            return (
              <li
                key={plan.id}
                className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-3"
              >
                <span className="font-medium text-fg-primary">{plan.name}</span>
                {isActive && (
                  <span className="rounded-full bg-accent-warm/15 px-2 py-0.5 text-xs font-medium text-accent-warm">
                    Your plan
                  </span>
                )}
                {plan.status === 'coming-soon' && (
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-fg-tertiary">
                    Activating
                  </span>
                )}
                <span className="w-full text-sm text-fg-tertiary sm:w-auto sm:flex-1">
                  {plan.bullets[0]} · {plan.priceCopy}
                </span>
                {!isActive && plan.status === 'available' && (
                  <Link
                    href={plan.cta.href}
                    className="text-sm text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
                  >
                    {plan.cta.label} →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
