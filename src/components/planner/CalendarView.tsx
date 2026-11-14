'use client';

/**
 * Your calendar: one line to add something (said or typed, the rest is
 * taps), and your coming days underneath, from every place you keep them.
 * Your Cat and your bots read this same list, and write to it when you ask.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatTime, isWallTime } from '@bitbaum/whenkit';
import { CalendarDays, CheckCircle2, X } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import EntityListShell from '@/components/entity/EntityListShell';
import { QuickAdd } from './QuickAdd';
import { browserToday, dayHeading } from './days';
import type { CalendarPage, CalendarPageRow } from '@/services/planner/calendar-page';
import type { QuickAdd as Parsed } from '@/services/planner/quick-add';
import { APP_LOCALE } from '@/utils/locale';
import { browserTimeZone } from '@/utils/timezone';
import { logger } from '@/utils/logger';

const COPY = {
  title: 'Calendar',
  description: 'Your coming days. Your Cat and your bots read this, and add to it when you ask.',
  quick: {
    label: 'Add to your calendar',
    placeholder: 'Dentist Monday 9am at Chur',
    when: 'Day',
    time: 'Time',
    allDay: 'All day',
    length: 'How long',
    add: 'Add to calendar',
    adding: 'Adding…',
    otherDate: 'Another date…',
  },
  remove: (title: string) => `Remove ${title}`,
  emptyTitle: 'Nothing planned yet',
  empty: 'Say or type what is coming up, in one line. Your Cat can add things for you too.',
  failed: 'Your calendar could not be loaded. Try again in a moment.',
  notAdded: 'That could not be added. Try again.',
  notRemoved: 'That could not be removed. Try again.',
  tasks: 'To-do list',
} as const;

/** What a row is, when it is not one of your own entries. */
const SOURCE_WORD: Record<CalendarPageRow['source'], string | null> = {
  calendar: null,
  task: 'Task due',
  reminder: 'Reminder',
  google: 'Google calendar',
};

export function CalendarView() {
  const [page, setPage] = useState<CalendarPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_ROUTES.CALENDAR.BASE}?days=30&zone=${encodeURIComponent(browserTimeZone())}`
      );
      const json = (await res.json()) as { data?: CalendarPage };
      if (!res.ok || !json.data) {
        throw new Error('calendar not loaded');
      }
      setPage(json.data);
      setFailed(false);
    } catch (error) {
      logger.error('calendar load failed', error, 'CalendarPage');
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(entry: Parsed): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.CALENDAR.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: entry.title,
          // A day alone is all day; a day and a wall time is that moment in your own clock.
          start: entry.time ? `${entry.day}T${entry.time}` : entry.day,
          minutes: entry.time ? (entry.minutes ?? 60) : null,
          location: entry.place,
          zone: browserTimeZone(),
        }),
      });
      if (!res.ok) {
        throw new Error('not added');
      }
      await load();
      return true;
    } catch {
      toast.error(COPY.notAdded);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(entryId: string) {
    const res = await fetch(API_ROUTES.CALENDAR.BY_ID(entryId), { method: 'DELETE' }).catch(
      () => null
    );
    if (!res?.ok) {
      toast.error(COPY.notRemoved);
      return;
    }
    await load();
  }

  const today = page?.today ?? browserToday();
  return (
    <EntityListShell
      title={COPY.title}
      description={COPY.description}
      headerActions={
        <Link
          href={ROUTES.DASHBOARD.TASKS}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-default px-4 text-sm text-fg-primary hover:bg-surface-raised"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {COPY.tasks}
        </Link>
      }
    >
      <div className="oc-planner mx-auto flex max-w-2xl flex-col gap-8">
        <QuickAdd kind="calendar" today={today} copy={COPY.quick} busy={busy} onAdd={add} />

        {failed && (
          <p role="alert" className="mb-0 text-sm text-status-negative">
            {COPY.failed}
          </p>
        )}
        {!failed && !page && (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-raised" />
            ))}
          </div>
        )}
        {page && page.byDay.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarDays className="h-10 w-10 text-fg-tertiary" aria-hidden="true" />
            <p className="mb-0 text-lg font-semibold text-fg-primary">{COPY.emptyTitle}</p>
            <p className="mb-0 max-w-sm text-base text-fg-secondary">{COPY.empty}</p>
          </div>
        )}
        {page?.byDay.map(day => (
          <section key={day.day} aria-label={dayHeading(day.day, today)}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-fg-secondary">
              {dayHeading(day.day, today)}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-default bg-surface-base">
              {day.rows.map((row, i) => (
                <li
                  key={`${row.entryId ?? row.title}-${i}`}
                  className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-b-0"
                >
                  <span className="w-20 shrink-0 text-sm tabular-nums text-fg-secondary">
                    {row.time.split(' to ').map((part, n) => (
                      <span key={n} className={n === 0 ? 'block text-fg-primary' : 'block'}>
                        {isWallTime(part) ? formatTime(part, APP_LOCALE) : part}
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-fg-primary">{row.title}</span>
                    {(row.location || SOURCE_WORD[row.source]) && (
                      <span className="block truncate text-sm text-fg-secondary">
                        {[SOURCE_WORD[row.source], row.location].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {row.entryId && (
                    <button
                      type="button"
                      aria-label={COPY.remove(row.title)}
                      onClick={() => void remove(row.entryId as string)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {page?.googleNote && <p className="mb-0 text-sm text-fg-secondary">{page.googleNote}</p>}
        {page?.zone && <p className="mb-0 text-xs text-fg-tertiary">Times in {page.zone}.</p>}
      </div>
    </EntityListShell>
  );
}
