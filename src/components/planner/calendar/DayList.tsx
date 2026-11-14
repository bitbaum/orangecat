'use client';

/**
 * Days as lists: what is on each, by time. Under the month grid it is the
 * one chosen day; as the List view it is the next thirty.
 */

import { Plus } from 'lucide-react';
import { formatTime, isWallTime, type ISODate } from '@bitbaum/whenkit';
import type { CalendarPageRow } from '@/services/planner/calendar-page';
import { APP_LOCALE } from '@/utils/locale';
import { dayHeading } from '../days';
import { CALENDAR_COPY } from './copy';

const clock = (part: string) => (isWallTime(part) ? formatTime(part, APP_LOCALE) : part);

export function DayList({
  days,
  today,
  byDay,
  onOpen,
  onAdd,
  showEmpty,
}: {
  days: ISODate[];
  today: ISODate;
  byDay: ReadonlyMap<string, CalendarPageRow[]>;
  onOpen: (row: CalendarPageRow, day: ISODate) => void;
  /** Given: each day offers "Add on …". */
  onAdd?: (day: ISODate) => void;
  /** Show a day with nothing on it (the chosen day), or leave it out (the list). */
  showEmpty: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {days.map(day => {
        const rows = byDay.get(day) ?? [];
        if (!showEmpty && rows.length === 0) {
          return null;
        }
        return (
          <section key={day} aria-label={dayHeading(day, today)}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <h2 className="mb-0 text-sm font-semibold text-fg-secondary">
                {dayHeading(day, today)}
              </h2>
              {onAdd && (
                <button
                  type="button"
                  onClick={() => onAdd(day)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-fg-secondary hover:bg-surface-raised hover:text-fg-primary"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {CALENDAR_COPY.add}
                </button>
              )}
            </div>
            {rows.length === 0 ? (
              <p className="mb-0 rounded-2xl border border-dashed border-default px-4 py-4 text-sm text-fg-secondary">
                {CALENDAR_COPY.nothingThatDay}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-default bg-surface-base">
                {rows.map((row, i) => (
                  <li
                    key={`${row.entryId ?? row.title}-${i}`}
                    className="border-b border-subtle last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(row, day)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised"
                    >
                      <span className="w-20 shrink-0 text-sm tabular-nums text-fg-secondary">
                        {row.time.split(' to ').map((part, n) => (
                          <span key={n} className={n === 0 ? 'block text-fg-primary' : 'block'}>
                            {clock(part)}
                          </span>
                        ))}
                      </span>
                      <span
                        className={`h-9 w-1 shrink-0 rounded-full ${
                          row.source === 'calendar' ? 'bg-fg-primary' : 'bg-fg-tertiary'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base text-fg-primary">
                          {row.title}
                        </span>
                        {(row.location || row.calendarName || CALENDAR_COPY.source[row.source]) && (
                          <span className="block truncate text-sm text-fg-secondary">
                            {[row.calendarName ?? CALENDAR_COPY.source[row.source], row.location]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
