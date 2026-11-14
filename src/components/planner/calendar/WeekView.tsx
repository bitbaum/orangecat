'use client';

/**
 * A week as a diary: one column per day, the hours down the side, each entry
 * a block from its start to its end, side by side where two overlap. All-day
 * entries and tasks due that day sit in a row above the hours. A tap on an
 * empty hour adds something at that hour. Seven days on a wide screen, three
 * on a phone, where seven 48px columns would hold no word at all.
 */

import { useEffect, useRef } from 'react';
import { formatTime, isWallTime, nowIn, type ISODate } from '@bitbaum/whenkit';
import type { CalendarPageRow } from '@/services/planner/calendar-page';
import { APP_LOCALE } from '@/utils/locale';
import { dayChip } from '../days';
import { CALENDAR_COPY } from './copy';
import { hourLabel, layoutDay, weekdayName } from './grid';

/** Height of one hour, in pixels. */
const HOUR = 52;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Where the grid opens: the working day, not midnight. */
const OPEN_AT = 7;

const pad = (n: number) => String(n).padStart(2, '0');
const label = (h: number) => formatTime(`${pad(h)}:00`, APP_LOCALE);
const startOf = (row: CalendarPageRow) => {
  const t = row.time.split(' to ')[0];
  return isWallTime(t) ? formatTime(t, APP_LOCALE) : '';
};

export function WeekView({
  days,
  today,
  zone,
  byDay,
  onOpen,
  onAddAt,
  onSelectDay,
}: {
  days: ISODate[];
  today: ISODate;
  zone: string | null;
  byDay: ReadonlyMap<string, CalendarPageRow[]>;
  onOpen: (row: CalendarPageRow, day: ISODate) => void;
  /** An empty hour was tapped. */
  onAddAt: (day: ISODate, time: string) => void;
  onSelectDay: (day: ISODate) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = OPEN_AT * HOUR - 8;
    }
  }, []);

  const now = nowIn(zone ?? 'UTC');
  const nowTop = (Number(now.slice(0, 2)) * 60 + Number(now.slice(3, 5))) * (HOUR / 60);
  const cols = { gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` };
  const allDay = days.map(d => (byDay.get(d) ?? []).filter(r => r.startMinute === null));
  const hasAllDay = allDay.some(r => r.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-default bg-surface-base">
      <div className="grid border-b border-subtle" style={cols}>
        <div />
        {days.map(day => (
          <button
            key={day}
            type="button"
            onClick={() => onSelectDay(day)}
            className="flex min-h-14 flex-col items-center justify-center border-l border-subtle text-sm hover:bg-surface-raised"
          >
            <span
              className={`text-xs uppercase tracking-wide ${day === today ? 'font-semibold text-fg-primary' : 'text-fg-secondary'}`}
            >
              {weekdayName(day)}
            </span>
            <span
              className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full tabular-nums ${
                day === today ? 'bg-fg-primary font-semibold text-fg-inverted' : 'text-fg-primary'
              }`}
            >
              {Number(day.slice(8))}
            </span>
          </button>
        ))}
      </div>
      {hasAllDay && (
        <div className="grid border-b border-subtle" style={cols}>
          <div className="px-1 py-2 text-right text-[11px] leading-tight text-fg-tertiary">
            {CALENDAR_COPY.allDay}
          </div>
          {days.map((day, i) => (
            <div key={day} className="flex min-w-0 flex-col gap-1 border-l border-subtle p-1">
              {allDay[i].map((row, n) => (
                <button
                  key={`${row.entryId ?? row.title}-${n}`}
                  type="button"
                  onClick={() => onOpen(row, day)}
                  className={`truncate rounded-md px-1.5 py-1 text-left text-xs ${
                    row.source === 'calendar'
                      ? 'bg-fg-primary text-fg-inverted'
                      : 'border border-default text-fg-primary'
                  }`}
                >
                  {row.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div
        ref={scroller}
        className="max-h-[60vh] overflow-y-auto overscroll-contain lg:max-h-[68vh]"
      >
        <div className="relative grid" style={{ ...cols, height: 24 * HOUR }}>
          <div className="relative">
            {HOURS.slice(1).map(h => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-fg-tertiary"
                style={{ top: h * HOUR }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map(day => {
            const placed = layoutDay(byDay.get(day) ?? []);
            return (
              <div key={day} className="relative border-l border-subtle">
                {HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`${CALENDAR_COPY.addOn(dayChip(day, today))}, ${label(h)}`}
                    onClick={() => onAddAt(day, `${pad(h)}:00`)}
                    className="absolute inset-x-0 border-t border-subtle hover:bg-surface-raised"
                    style={{ top: h * HOUR, height: HOUR }}
                  />
                ))}
                {placed.map(({ item: row, lane, lanes }, n) => {
                  const top = (row.startMinute as number) * (HOUR / 60);
                  const height = Math.max(
                    22,
                    ((row.endMinute as number) - (row.startMinute as number)) * (HOUR / 60) - 2
                  );
                  return (
                    <button
                      key={`${row.entryId ?? row.title}-${n}`}
                      type="button"
                      onClick={() => onOpen(row, day)}
                      className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight shadow-sm ${
                        row.source === 'calendar'
                          ? 'bg-fg-primary text-fg-inverted'
                          : 'border border-default bg-surface-raised text-fg-primary'
                      }`}
                      style={{
                        top: top + 1,
                        height,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-medium">{row.title}</span>
                      {height > 34 && (
                        <span className="block truncate opacity-80">
                          {[startOf(row), row.location].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </button>
                  );
                })}
                {day === today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-status-negative"
                    style={{ top: nowTop }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
