import { Check } from 'lucide-react';
import type { Journey, JourneyStop } from '@/lib/development/roadmap-journey';

/**
 * The roadmap drawn as a road: behind us, a "you are here" where the work is,
 * the stops ahead, and the horizon — instead of four stacked lists that made
 * the reader work out where things stand.
 *
 * The headline answers "how far along" first; every stop's ring fills from
 * ticked steps only. Server-rendered, no client JavaScript: steps open with
 * <details>, and the only motion (the beacon, rings drawing in) stops under
 * prefers-reduced-motion. Same journey as Loki's /roadmap.
 */
export function RoadmapJourney({ journey }: { journey: Journey }) {
  const segments = [
    { phase: 'shipped', count: journey.shipped.length, label: 'shipped', href: '#shipped' },
    { phase: 'now', count: journey.now.length, label: 'being built', href: '#now' },
    { phase: 'next', count: journey.next.length, label: 'next', href: '#next' },
    { phase: 'later', count: journey.later.length, label: 'later', href: '#later' },
  ].filter(s => s.count > 0);
  const total = segments.reduce((n, s) => n + s.count, 0);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4 rounded-3xl border border-subtle bg-surface-base p-5 sm:p-8">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="oc-journey-percent">{journey.percentShipped}%</span>
          <span className="text-base text-fg-secondary sm:text-lg">of the road is shipped</span>
        </div>
        <div
          className="flex h-3 w-full gap-1 overflow-hidden rounded-full"
          role="img"
          aria-label={`${total} items: ${segments.map(s => `${s.count} ${s.label}`).join(', ')}`}
        >
          {segments.map(s => (
            <span
              key={s.phase}
              className="oc-journey-seg"
              data-phase={s.phase}
              style={{ flexGrow: s.count }}
            />
          ))}
        </div>
        <nav className="flex flex-wrap gap-x-4" aria-label="Roadmap sections">
          {segments.map(s => (
            <a
              key={s.phase}
              href={s.href}
              className="oc-journey-legend inline-flex min-h-11 items-center gap-2 text-sm text-fg-secondary hover:text-fg-primary"
              data-phase={s.phase}
            >
              <span className="oc-journey-dot" aria-hidden />
              {s.count} {s.label}
            </a>
          ))}
        </nav>
        {journey.stepsTotal > 0 && (
          <p className="text-sm text-fg-tertiary">
            {journey.stepsDone} of {journey.stepsTotal} steps done on the road ahead
          </p>
        )}
      </div>

      <ol className="flex flex-col">
        {journey.shipped.length > 0 && (
          <li id="shipped" className="oc-journey-stop" data-phase="shipped">
            <span className="oc-journey-marker" aria-hidden>
              <Check className="h-5 w-5" />
            </span>
            <details className="min-w-0 flex-1 pt-2.5">
              <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-baseline gap-x-3">
                <span className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                  Behind us
                </span>
                <span className="text-lg font-semibold text-fg-primary sm:text-xl">
                  {journey.shipped.length} shipped
                </span>
                <span className="text-sm text-fg-tertiary">Show them</span>
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
                {journey.shipped.map(s => (
                  <li key={s.title} className="flex items-start gap-2 text-sm text-fg-secondary">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-positive"
                      aria-hidden
                    />
                    <span className="min-w-0">{s.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )}
        {journey.now.map((stop, i) => (
          <Stop key={stop.title} stop={stop} here={i === 0} anchor={i === 0 ? 'now' : undefined} />
        ))}
        {journey.next.map((stop, i) => (
          <Stop key={stop.title} stop={stop} anchor={i === 0 ? 'next' : undefined} />
        ))}
        {journey.later.length > 0 && (
          <li id="later" className="oc-journey-stop" data-phase="later">
            <span className="oc-journey-marker" aria-hidden />
            <div className="min-w-0 flex-1 pt-2">
              <span className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                On the horizon
              </span>
              <ul className="mt-3 flex flex-col gap-2">
                {journey.later.map(s => (
                  <li key={s.title} className="font-medium text-fg-primary">
                    {s.title}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

function Stop({
  stop,
  here = false,
  anchor,
}: {
  stop: JourneyStop;
  here?: boolean;
  anchor?: string;
}) {
  return (
    <li
      id={anchor}
      className="oc-journey-stop"
      data-phase={stop.phase}
      data-here={here || undefined}
    >
      <span className="oc-journey-marker" aria-hidden>
        <Ring percent={stop.percent} />
      </span>
      <div className="oc-journey-card">
        {here && <span className="oc-journey-here">You are here</span>}
        {!here && stop.phase === 'now' && (
          <span className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
            Also being built
          </span>
        )}
        <h3 className="text-lg font-semibold text-fg-primary sm:text-xl">{stop.title}</h3>
        {stop.nextStep && (
          <p className="text-sm text-fg-secondary">
            <span className="mr-1 rounded-md bg-surface-raised px-1.5 py-0.5 text-xs font-medium text-fg-primary">
              Next step
            </span>{' '}
            {stop.nextStep}
          </p>
        )}
        {stop.steps.length > 0 && (
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-fg-tertiary hover:text-fg-secondary">
              {stop.countable > 0
                ? `${stop.done}/${stop.countable} steps`
                : `${stop.steps.length} steps`}
              {stop.targetDate ? ` · target ${stop.targetDate}` : ''}
            </summary>
            <ul className="mt-1 flex flex-col gap-2">
              {stop.steps.map(m => (
                <li
                  key={m.title}
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
                </li>
              ))}
            </ul>
          </details>
        )}
        {stop.steps.length === 0 && stop.targetDate && (
          <p className="text-sm text-fg-tertiary">target {stop.targetDate}</p>
        )}
      </div>
    </li>
  );
}

const R = 17;
const C = 2 * Math.PI * R;

function Ring({ percent }: { percent: number | null }) {
  const filled = percent === null ? 0 : (percent / 100) * C;
  return (
    <svg viewBox="0 0 40 40" className="h-12 w-12">
      <circle cx="20" cy="20" r={R} className="oc-journey-ring-track" />
      {percent !== null && percent > 0 && (
        <circle
          cx="20"
          cy="20"
          r={R}
          className="oc-journey-ring-fill"
          strokeDasharray={`${filled} ${C}`}
          transform="rotate(-90 20 20)"
        />
      )}
      {percent !== null && (
        <text
          x="20"
          y="20"
          className="oc-journey-ring-text"
          dominantBaseline="central"
          textAnchor="middle"
        >
          {percent}
        </text>
      )}
    </svg>
  );
}
