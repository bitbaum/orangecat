'use client';

import { Plus, X } from 'lucide-react';
import { RAISE_LIMITS } from '@/config/raise';
import type { RaiseFlow } from '@/hooks/useRaiseFlow';

/**
 * What it costs, line by line — every label and price editable in place. The
 * total above recomputes as you type, so B is always the sum of what you see.
 */
export function CostLines({ flow }: { flow: RaiseFlow }) {
  const plan = flow.plan;
  if (!plan) {
    return null;
  }
  return (
    <section aria-labelledby="raise-costs">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="raise-costs" className="text-sm font-semibold text-fg-primary">
          What it costs
        </h2>
        <span className="text-xs text-fg-tertiary">
          {plan.estimated ? 'The Cat’s estimate — change any price' : 'Your prices'}
        </span>
      </div>

      {plan.lines.length === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-default p-4 text-sm text-fg-secondary">
          The Cat could not price this one. Add what it costs below — one line is enough.
        </p>
      )}

      <ul className="mt-3 divide-y divide-subtle rounded-2xl border border-default bg-surface-base">
        {plan.lines.map((line, i) => (
          <li key={i} className="flex items-center gap-1.5 py-1.5 pl-3 pr-1 sm:gap-2 sm:px-3">
            <label className="sr-only" htmlFor={`raise-line-${i}`}>
              What this pays for
            </label>
            <input
              id={`raise-line-${i}`}
              value={line.label}
              maxLength={RAISE_LIMITS.lineLabelMax}
              onChange={e => flow.editLine(i, { label: e.target.value })}
              placeholder="What this pays for"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none"
            />
            <label className="sr-only" htmlFor={`raise-amount-${i}`}>
              Amount in {plan.currency}
            </label>
            <span className="hidden text-xs text-fg-tertiary sm:inline" aria-hidden>
              {plan.currency}
            </span>
            <input
              id={`raise-amount-${i}`}
              inputMode="decimal"
              value={line.amount ? String(line.amount) : ''}
              onChange={e => {
                const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
                flow.editLine(i, { amount: Number.isFinite(n) ? n : 0 });
              }}
              placeholder="0"
              className="min-h-11 w-16 bg-transparent sm:w-24 text-right text-sm font-medium tabular-nums text-fg-primary placeholder:text-fg-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={() => flow.removeLine(i)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
              aria-label={`Remove ${line.label || 'this line'}`}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
        {plan.lines.length < RAISE_LIMITS.maxLines && (
          <li>
            <button
              type="button"
              onClick={flow.addLine}
              className="flex min-h-11 w-full items-center gap-2 px-4 text-sm text-fg-secondary hover:text-fg-primary"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add a line
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
