'use client';

import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { RAISE_LIMITS } from '@/config/raise';
import type { RaiseFlow } from '@/hooks/useRaiseFlow';
import { CostLines } from './CostLines';
import { RailPicker } from './RailPicker';

/**
 * Step two: the plan, ready to publish. B leads — one big number — then what
 * it is made of, how to ask, and the words. Beside it (below on a phone) is
 * the page exactly as backers will see it, so nothing is a surprise.
 */
export function PlanStep({ flow }: { flow: RaiseFlow }) {
  const plan = flow.plan;
  if (!plan) {
    return null;
  }
  const publishing = flow.step === 'publishing';
  return (
    <div className="mx-auto max-w-5xl pb-28 lg:pb-0">
      <button
        type="button"
        onClick={flow.startOver}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Something else
      </button>

      <div className="oc-raise-reveal mt-4">
        <p className="text-sm text-fg-secondary">To get this, you need</p>
        <p className="mt-1 whitespace-nowrap text-4xl font-semibold tracking-display tabular-nums text-fg-primary min-[360px]:text-5xl sm:text-6xl">
          {flow.format(flow.total)}
        </p>
        <p className="mt-2 max-w-xl text-fg-secondary">{plan.need}</p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <CostLines flow={flow} />
          <RailPicker flow={flow} />
          <section aria-labelledby="raise-words" className="space-y-3">
            <h2 id="raise-words" className="text-sm font-semibold text-fg-primary">
              Your page
            </h2>
            <label className="block">
              <span className="text-xs text-fg-tertiary">Title</span>
              <input
                value={plan.title}
                maxLength={RAISE_LIMITS.titleMax}
                onChange={e => flow.edit({ title: e.target.value })}
                className="mt-1 block min-h-11 w-full rounded-xl border border-default bg-surface-base px-3 font-medium text-fg-primary focus:border-interactive focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-fg-tertiary">Why it matters — in your words</span>
              <textarea
                value={plan.story}
                maxLength={RAISE_LIMITS.storyMax}
                rows={5}
                onChange={e => flow.edit({ story: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-default bg-surface-base px-3 py-2.5 text-fg-primary focus:border-interactive focus:outline-none"
              />
            </label>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Preview flow={flow} />
          <div className="mt-4 hidden lg:block">
            <PublishButton flow={flow} publishing={publishing} />
          </div>
        </aside>
      </div>

      {/* Phones: the one action stays under the thumb at any scroll position. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-surface-page/95 p-3 backdrop-blur lg:hidden">
        <PublishButton flow={flow} publishing={publishing} />
      </div>
    </div>
  );
}

function PublishButton({ flow, publishing }: { flow: RaiseFlow; publishing: boolean }) {
  return (
    <div>
      {flow.error && (
        <p role="alert" className="mb-2 text-sm text-status-negative">
          {flow.error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void flow.publish()}
        disabled={publishing || flow.total <= 0}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-warm px-6 font-medium text-on-accent transition-opacity disabled:opacity-40"
      >
        {publishing ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        {publishing
          ? 'Publishing…'
          : flow.isAuthenticated
            ? 'Publish and share'
            : 'Sign in to publish'}
      </button>
      {!flow.isAuthenticated && (
        <p className="mt-2 text-center text-xs text-fg-tertiary">
          Your plan waits right here while you sign in.
        </p>
      )}
    </div>
  );
}

/** The page as a backer will meet it: title, story, the goal at zero. */
function Preview({ flow }: { flow: RaiseFlow }) {
  const plan = flow.plan!;
  return (
    <div className="rounded-3xl border border-default bg-surface-base p-5">
      <p className="text-xs uppercase tracking-caps text-fg-tertiary">What people will see</p>
      <h3 className="mt-3 text-xl font-semibold text-fg-primary [overflow-wrap:anywhere]">
        {plan.title || 'Your title'}
      </h3>
      <p className="mt-2 line-clamp-4 text-sm text-fg-secondary [overflow-wrap:anywhere]">
        {plan.story}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-raised">
        <div className="oc-raise-bar h-full w-[2%] rounded-full bg-accent-warm" />
      </div>
      <p className="mt-2 text-sm text-fg-secondary">
        <span className="font-medium text-fg-primary">{flow.format(0)}</span> of{' '}
        {flow.format(flow.total)}
      </p>
      {plan.lines.length > 1 && (
        <ul className="mt-4 space-y-1 border-t border-subtle pt-4 text-sm">
          {plan.lines
            .filter(l => l.label && l.amount > 0)
            .map((l, i) => (
              <li key={i} className="flex justify-between gap-3 text-fg-secondary">
                <span className="min-w-0 truncate">{l.label}</span>
                <span className="shrink-0 tabular-nums">{flow.format(l.amount)}</span>
              </li>
            ))}
        </ul>
      )}
      <p className="mt-4 rounded-xl bg-surface-raised px-3 py-2 text-xs text-fg-secondary">
        {flow.railCopy?.strings}
        {plan.rail !== 'fund' && ` ${plan.ratePercent}% a year, ${plan.termMonths} months.`}
      </p>
    </div>
  );
}
