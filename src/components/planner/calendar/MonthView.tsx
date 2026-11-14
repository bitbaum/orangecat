'use client';

/**
 * A month as a month: seven columns, whole weeks, today ringed, the chosen
 * day filled. On a phone each day shows dots for what is on (a 54px cell has
 * no room for words, and a title cut to three letters says nothing); on a
 * wider screen it shows the first entries by time and title. The chosen
 * day's entries are listed under the grid either way.
 */

import { formatTime, isWallTime, type ISODate } from '@bitbaum/whenkit';
import type { CalendarPageRow } from '@/services/planner/calendar-page';
import { APP_LOCALE } from '@/utils/locale';
import { CALENDAR_COPY } from './copy';
import { monthDays, weekdayNames } from './grid';

/** How many entries a day cell names before "+2 more". */
const NAMED = 3;
/** How many dots a phone cell draws. */
const DOTS = 3;

const shortTime = (time: string) => {
  const start = time.split(' to ')[0];
  return isWallTime(start) ? formatTime(start, APP_LOCALE) : '';
};

export function MonthView({
  anchor,
  today,
  selected,
  byDay,
  onSelect,
  onOpen,
}: {
  /** Any day of the month to draw. */
  anchor: ISODate;
  today: ISODate;
  selected: ISODate;
  byDay: ReadonlyMap<string, CalendarPageRow[]>;
  onSelect: (day: ISODate) => void;
  onOpen: (row: CalendarPageRow, day: ISODate) => void;
}) {
  const days = monthDays(anchor);
  const month = anchor.slice(0, 7);
  const names = weekdayNames();
  return (
    <div className="overflow-hidden rounded-2xl border border-default bg-surface-base">
      <div className="grid grid-cols-7 border-b border-subtle" aria-hidden="true">
        {names.map(n => (
          <div key={n} className="py-2 text-center text-xs font-medium text-fg-tertiary">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" role="grid" aria-label={CALENDAR_COPY.title}>
        {days.map((day, i) => {
          const rows = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month;
          const isToday = day === today;
          const isSelected = day === selected;
          return (
            <div
              key={day}
              role="gridcell"
              aria-selected={isSelected}
              className={`relative min-h-14 border-subtle lg:min-h-28 ${i % 7 !== 6 ? 'border-r' : ''} ${
                i < days.length - 7 ? 'border-b' : ''
              } ${isSelected ? 'bg-surface-raised' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelect(day)}
                aria-label={`${day}${rows.length ? `, ${rows.length}` : ''}`}
                className="absolute inset-0 h-full w-full hover:bg-surface-raised focus-visible:z-10"
              />
              <div className="pointer-events-none relative flex flex-col items-center gap-1 p-1 lg:items-stretch lg:p-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums lg:self-start ${
                    isToday
                      ? 'bg-fg-primary font-semibold text-fg-inverted'
                      : inMonth
                        ? 'text-fg-primary'
                        : 'text-fg-tertiary'
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                {rows.length > 0 && (
                  <span className="flex gap-0.5 lg:hidden" aria-hidden="true">
                    {rows.slice(0, DOTS).map((r, n) => (
                      <span
                        key={n}
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.source === 'calendar' ? 'bg-fg-primary' : 'bg-fg-tertiary'
                        }`}
                      />
                    ))}
                  </span>
                )}
                <span className="hidden flex-col gap-0.5 lg:flex">
                  {rows.slice(0, NAMED).map((r, n) => (
                    <button
                      key={`${r.entryId ?? r.title}-${n}`}
                      type="button"
                      onClick={() => onOpen(r, day)}
                      className="pointer-events-auto truncate rounded px-1 text-left text-xs text-fg-primary hover:bg-surface-overlay"
                    >
                      <span className="tabular-nums text-fg-secondary">{shortTime(r.time)} </span>
                      {r.title}
                    </button>
                  ))}
                  {rows.length > NAMED && (
                    <span className="px-1 text-xs text-fg-secondary">
                      {CALENDAR_COPY.more(rows.length - NAMED)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
