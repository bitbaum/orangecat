import { Check } from 'lucide-react';
import type { ChangeRef, LinkedGoal } from 'bip-kit';
import { ROUTES } from '@/config/routes';

/** One link per changelog day, however many of its lines cite the step. */
const byDay = (refs: ChangeRef[]) =>
  refs.filter((c, i) => refs.findIndex(r => r.anchor === c.anchor) === i);

/**
 * A goal's milestones, each with the changelog days that delivered it. The
 * link is the `{#id}` the record carries on both sides (bip-kit
 * linkDevelopment); a milestone with an id can be linked to from the
 * changelog, so it carries that id as its anchor.
 */
export function RoadmapSteps({ goal }: { goal: LinkedGoal }) {
  return (
    <ul className="mt-1 flex flex-col gap-2">
      {goal.steps.map((m, i) => (
        <li
          key={m.anchor ?? `${m.title}-${i}`}
          id={m.anchor ?? undefined}
          className="oc-journey-step-row flex flex-col gap-0.5"
        >
          <span
            className={
              m.done
                ? 'flex gap-2.5 text-sm text-fg-tertiary line-through'
                : 'flex gap-2.5 text-sm text-fg-secondary'
            }
          >
            <span className="oc-journey-step" data-done={m.done || undefined} aria-hidden>
              {m.done ? <Check className="h-3 w-3" /> : null}
            </span>
            <span className="min-w-0">
              {m.title}
              {m.done !== null && (
                <span className="sr-only">{m.done ? ' — done' : ' — not done'}</span>
              )}
            </span>
          </span>
          {m.deliveredIn.length > 0 && (
            <span className="flex flex-wrap gap-x-2 pl-7 text-xs text-fg-tertiary">
              {m.done ? 'Shipped' : 'Worked on'}
              {byDay(m.deliveredIn).map((c, j) => (
                <a
                  key={`${c.anchor}-${j}`}
                  href={`${ROUTES.CHANGELOG}#${c.anchor}`}
                  title={c.line}
                  className="font-mono text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                >
                  {c.date}
                </a>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Worked on 2026-10-03 → 2026-10-07 · 6 changes" — the goal's record, linked. */
export function GoalRecord({ goal }: { goal: LinkedGoal }) {
  if (!goal.firstDate) {
    return null;
  }
  const n = goal.deliveredIn.length;
  const days = byDay(goal.deliveredIn).length;
  return (
    <p className="text-xs text-fg-tertiary">
      In the changelog{' '}
      <a
        href={`${ROUTES.CHANGELOG}#${goal.deliveredIn[0].anchor}`}
        className="font-mono text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
      >
        {goal.firstDate}
      </a>
      {goal.lastDate && goal.lastDate !== goal.firstDate && (
        <>
          {' → '}
          <a
            href={`${ROUTES.CHANGELOG}#${goal.deliveredIn[n - 1].anchor}`}
            className="font-mono text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            {goal.lastDate}
          </a>
        </>
      )}{' '}
      · {n} {n === 1 ? 'change' : 'changes'}
      {days > 1 ? ` over ${days} days` : ''}
    </p>
  );
}
