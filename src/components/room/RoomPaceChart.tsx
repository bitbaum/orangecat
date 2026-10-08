import type { RepoPace } from '@/domain/projectRooms/evidence';
import { APP_LOCALE } from '@/utils/locale';

function weekLabel(start: string): string {
  return new Date(`${start}T12:00:00Z`).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Changes merged to main, week by week — one series, so no legend: the title
 * names it. Thin bars with a 2px gap and rounded data-ends; every bar has its
 * own hover label, and the same numbers are listed for screen readers. The
 * current week is drawn lighter and labelled "so far", so a Tuesday never reads
 * as a collapse.
 */
export function RoomPaceChart({ pace }: { pace: RepoPace }) {
  const max = Math.max(1, ...pace.weeks.map(w => w.count));
  const last = pace.weeks.length - 1;
  // Selective direct labels: the busiest full week and this week, not every bar.
  const busiest = pace.weeks
    .slice(0, last)
    .reduce((best, w, i, all) => (w.count > all[best].count ? i : best), 0);
  const fullWeeks = Math.max(1, last);
  const perWeek = Math.round(
    pace.weeks.slice(0, last).reduce((s, w) => s + w.count, 0) / fullWeeks
  );

  return (
    <figure className="mt-4">
      <p className="text-sm text-fg-secondary">
        <span className="font-semibold text-fg-primary">
          {pace.total}
          {pace.capped ? '+' : ''} changes
        </span>{' '}
        in {pace.weeks.length} {pace.weeks.length === 1 ? 'week' : 'weeks'}
        {last > 0 && <> · about {perWeek} a week</>}
      </p>
      <div className="mt-4 flex h-32 items-end gap-0.5" aria-hidden>
        {pace.weeks.map((week, i) => (
          <div
            key={week.start}
            className="relative flex h-full flex-1 flex-col items-center justify-end"
            title={`Week of ${weekLabel(week.start)}: ${week.count}${i === last ? ' so far' : ''}`}
          >
            {(i === busiest || i === last) && week.count > 0 && (
              <span className="mb-1 text-xs tabular-nums text-fg-secondary">{week.count}</span>
            )}
            <div
              className={`w-full max-w-10 rounded-t bg-accent-warm ${i === last ? 'opacity-40' : ''}`}
              style={{ height: `${week.count === 0 ? 0 : Math.max(4, (week.count / max) * 80)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-fg-muted" aria-hidden>
        <span>{weekLabel(pace.weeks[0].start)}</span>
        <span>this week</span>
      </div>
      <ul className="sr-only">
        {pace.weeks.map((week, i) => (
          <li key={week.start}>
            Week of {weekLabel(week.start)}: {week.count} changes{i === last ? ' so far' : ''}
          </li>
        ))}
      </ul>
      <figcaption className="mt-2 text-xs text-fg-muted">
        Changes merged to the main branch per week, from{' '}
        <a
          href={pace.repoUrl}
          rel="noreferrer"
          target="_blank"
          className="underline underline-offset-2 hover:text-fg-primary"
        >
          the public repository
        </a>
        .
      </figcaption>
    </figure>
  );
}
