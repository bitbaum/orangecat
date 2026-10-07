'use client';

import { Check } from 'lucide-react';
import {
  RAISE_DEFAULT_TERMS,
  RAISE_LIMITS,
  RAISE_RAIL_COPY,
  RAISE_RAILS,
  type RaiseRail,
} from '@/config/raise';
import type { RaiseFlow } from '@/hooks/useRaiseFlow';

/**
 * How to ask: as a gift, a loan, or an investment — the whole economic
 * spectrum in three cards. The Cat's pick is marked and explained; switching
 * is one tap, and a loan or investment shows its terms right there.
 */
export function RailPicker({ flow }: { flow: RaiseFlow }) {
  const plan = flow.plan;
  if (!plan) {
    return null;
  }
  const choose = (rail: RaiseRail) => {
    if (rail === plan.rail) {
      return;
    }
    const terms = rail === 'invest' ? RAISE_DEFAULT_TERMS.invest : RAISE_DEFAULT_TERMS.lend;
    flow.edit({ rail, ratePercent: terms.ratePercent, termMonths: terms.termMonths });
  };
  return (
    <section aria-labelledby="raise-rail">
      <h2 id="raise-rail" className="text-sm font-semibold text-fg-primary">
        How do you want to ask?
      </h2>
      <div
        role="radiogroup"
        aria-labelledby="raise-rail"
        className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {RAISE_RAILS.map(rail => {
          const copy = RAISE_RAIL_COPY[rail];
          const on = plan.rail === rail;
          return (
            <button
              key={rail}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(rail)}
              className={
                on
                  ? 'oc-raise-rail flex min-w-0 flex-col rounded-2xl border border-interactive bg-surface-raised p-4 text-left'
                  : 'oc-raise-rail flex min-w-0 flex-col rounded-2xl border border-default bg-surface-base p-4 text-left hover:border-strong'
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fg-primary">{copy.label}</span>
                {on && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-warm text-on-accent">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </span>
              <span className="mt-1 text-sm text-fg-secondary">{copy.strings}</span>
              {flow.recommended === rail && (
                <span className="mt-2 text-xs text-fg-tertiary">✦ The Cat’s pick</span>
              )}
            </button>
          );
        })}
      </div>
      {flow.recommended === plan.rail && plan.railWhy && (
        <p className="mt-3 text-sm text-fg-secondary">{plan.railWhy}</p>
      )}
      {plan.rail !== 'fund' && <Terms flow={flow} />}
    </section>
  );
}

function Terms({ flow }: { flow: RaiseFlow }) {
  const plan = flow.plan!;
  const lend = plan.rail === 'lend';
  const num = (v: string, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <label className="block">
        <span className="text-xs text-fg-tertiary">
          {lend ? 'Interest you pay, % a year' : 'Expected return, % a year'}
        </span>
        <input
          inputMode="numeric"
          value={String(plan.ratePercent)}
          onChange={e => flow.edit({ ratePercent: num(e.target.value, RAISE_LIMITS.rateMax) })}
          className="mt-1 block min-h-11 w-full rounded-xl border border-default bg-surface-base px-3 text-fg-primary focus:border-interactive focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-xs text-fg-tertiary">
          {lend ? 'Repaid over, months' : 'Returns shared for, months'}
        </span>
        <input
          inputMode="numeric"
          value={String(plan.termMonths)}
          onChange={e =>
            flow.edit({ termMonths: Math.max(1, num(e.target.value, RAISE_LIMITS.termMonthsMax)) })
          }
          className="mt-1 block min-h-11 w-full rounded-xl border border-default bg-surface-base px-3 text-fg-primary focus:border-interactive focus:outline-none"
        />
      </label>
      <p className="col-span-2 text-xs text-fg-tertiary">
        {lend
          ? 'Lenders see these terms before they lend. You repay them directly.'
          : 'Investors see these terms before they invest. Returns are not guaranteed, and the page says so.'}
      </p>
    </div>
  );
}
