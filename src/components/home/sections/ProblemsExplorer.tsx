'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { PROBLEM_SCALES, type ProblemWeSolve } from '@/config/problems-we-solve';
import { cn } from '@/lib/utils';

/**
 * "Which one is yours?" — the twelve problems as a picker, not a wall.
 *
 * The section used to print every problem with its full answer: twelve cards
 * of three sentences, read top to bottom before a visitor could tell which
 * one was theirs. Now one scale shows at a time (For you / For everyone),
 * each problem is just its sentence in the person's own words, and choosing
 * one shows its one answer and its one action. On a phone the answer opens
 * under the problem tapped; from `md` up it sits beside the list. Same copy,
 * same registry links — about a sixth of the reading at any moment.
 */
export default function ProblemsExplorer() {
  const [scaleId, setScaleId] = useState(PROBLEM_SCALES[0].id);
  const scale = PROBLEM_SCALES.find(s => s.id === scaleId) ?? PROBLEM_SCALES[0];
  const [selectedId, setSelectedId] = useState(scale.items[0].id);
  const selected = scale.items.find(item => item.id === selectedId) ?? scale.items[0];

  const chooseScale = (id: typeof scaleId) => {
    const next = PROBLEM_SCALES.find(s => s.id === id) ?? PROBLEM_SCALES[0];
    setScaleId(next.id);
    setSelectedId(next.items[0].id);
  };

  return (
    <div className="mt-8 sm:mt-10">
      <div className="oc-problem-tabs" role="tablist" aria-label="Whose problem">
        {PROBLEM_SCALES.map(s => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`problem-tab-${s.id}`}
            aria-selected={s.id === scale.id}
            aria-controls="problem-panel"
            className={cn('oc-problem-tab', s.id === scale.id && 'oc-problem-tab-active')}
            onClick={() => chooseScale(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-fg-secondary sm:text-base">{scale.subtitle}</p>

      <div
        id="problem-panel"
        role="tabpanel"
        aria-labelledby={`problem-tab-${scale.id}`}
        className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8"
      >
        <ul className="flex min-w-0 flex-col gap-2">
          {scale.items.map(item => {
            const isSelected = item.id === selected.id;
            return (
              <li key={item.id} className="min-w-0">
                <button
                  type="button"
                  aria-expanded={isSelected}
                  className={cn('oc-problem-pick', isSelected && 'oc-problem-pick-active')}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.problem}
                </button>
                {isSelected && (
                  <div className="md:hidden">
                    <ProblemAnswer item={item} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="hidden md:block">
          <div className="sticky top-24">
            <ProblemAnswer item={selected} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemAnswer({ item }: { item: ProblemWeSolve }) {
  const meta = ENTITY_REGISTRY[item.entityType];
  const Icon = meta.icon;
  return (
    <div className="oc-problem-answer" aria-live="polite">
      <p className="text-base leading-relaxed text-fg-primary sm:text-lg">{item.solution}</p>
      <Link href={meta.createPath} className="oc-problem-action">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{meta.plain.verb}</span>
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    </div>
  );
}
