'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { RAISE_EXAMPLES, RAISE_LIMITS } from '@/config/raise';
import type { RaiseFlow } from '@/hooks/useRaiseFlow';

/** What the Cat is doing while it prices — said, so the wait reads as work. */
const THINKING = ['Pricing every part', 'Writing your page', 'Choosing how to ask'];
const THINKING_STEP_MS = 1400;

/** Step one: say what you need, in your own words. Nothing else on screen. */
export function NeedStep({ flow }: { flow: RaiseFlow }) {
  const planning = flow.step === 'planning';
  return (
    <div className="mx-auto max-w-2xl">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-caps text-fg-tertiary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> Raise money
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-display text-fg-primary sm:text-5xl">
        What do you need?
      </h1>
      <p className="mt-4 text-lg text-fg-secondary">
        Say it in a sentence. The Cat works out what it costs, writes your page, and you share one
        link.
      </p>

      <form
        className="mt-8"
        onSubmit={e => {
          e.preventDefault();
          void flow.priceIt();
        }}
      >
        <div className="oc-raise-box rounded-3xl border border-default bg-surface-base p-2 transition-colors focus-within:border-interactive">
          <label htmlFor="raise-need" className="sr-only">
            What do you need?
          </label>
          <textarea
            id="raise-need"
            value={flow.need}
            onChange={e => flow.setNeed(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void flow.priceIt();
              }
            }}
            maxLength={RAISE_LIMITS.needMax}
            rows={3}
            disabled={planning}
            placeholder="A second oven for my bakery so I can bake on weekdays too"
            className="block w-full resize-none bg-transparent px-4 pt-3 text-lg text-fg-primary placeholder:text-fg-muted focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <span className="text-xs text-fg-muted">
              Know the price? Say it — “about CHF 4,000”.
            </span>
            <button
              type="submit"
              disabled={planning || flow.need.trim().length < RAISE_LIMITS.needMin}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent-warm px-5 text-sm font-medium text-on-accent transition-opacity disabled:opacity-40"
            >
              {planning ? 'Pricing…' : 'Price it'}
              {!planning && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </form>

      {flow.error && (
        <p role="alert" className="mt-3 text-sm text-status-negative">
          {flow.error}
        </p>
      )}

      {planning ? (
        <Thinking />
      ) : (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-caps text-fg-tertiary">
            Or start from one of these
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {RAISE_EXAMPLES.map(example => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => void flow.priceIt(example)}
                  className="min-h-11 rounded-full border border-subtle px-4 text-left text-sm text-fg-secondary transition-colors hover:border-default hover:text-fg-primary"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(
      () => setI(n => Math.min(n + 1, THINKING.length - 1)),
      THINKING_STEP_MS
    );
    return () => window.clearInterval(t);
  }, []);
  return (
    <ol className="mt-10 space-y-3" aria-live="polite">
      {THINKING.map((label, j) => (
        <li
          key={label}
          className="oc-raise-think flex items-center gap-3 text-fg-secondary"
          data-state={j < i ? 'done' : j === i ? 'now' : 'next'}
        >
          <span className="oc-raise-think-dot" aria-hidden />
          {label}
          {j === i && '…'}
        </li>
      ))}
    </ol>
  );
}
