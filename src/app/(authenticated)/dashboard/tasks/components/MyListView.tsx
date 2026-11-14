'use client';

/**
 * Your to-do list: one line to add a task (said or typed), a tap to tick
 * one off, a tap on its day to move it. What is late is on top. The same
 * list your Cat and your bots read and add to.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, Circle, ListChecks } from 'lucide-react';
import { DayStrip } from '@bitbaum/whenkit/react';
import '@bitbaum/whenkit/styles.css';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import EntityListShell from '@/components/entity/EntityListShell';
import { QuickAdd } from '@/components/planner/QuickAdd';
import { browserToday, dayChip } from '@/components/planner/days';
import type { QuickAdd as Parsed } from '@/services/planner/quick-add';
import type { ListTask, TaskListPage } from '@/services/planner/tasks';
import { APP_LOCALE } from '@/utils/locale';
import { browserTimeZone } from '@/utils/timezone';
import { logger } from '@/utils/logger';

const COPY = {
  title: 'To-do',
  description: 'What you mean to do. Your Cat and your bots read this, and add to it when you ask.',
  quick: {
    label: 'Add a task',
    placeholder: 'Call the landlord tomorrow',
    when: 'Due',
    time: 'Time',
    allDay: 'All day',
    length: 'How long',
    add: 'Add task',
    adding: 'Adding…',
    otherDate: 'Another date…',
  },
  sections: { late: 'Late', today: 'Today', soon: 'Coming up', someday: 'No date' },
  done: (title: string) => `Tick off ${title}`,
  move: (title: string) => `Change the day of ${title}`,
  noDate: 'No date',
  reminder: 'Reminder',
  emptyTitle: 'Nothing to do',
  empty: 'Say or type a task in one line. "Call the landlord tomorrow" sets the day for you.',
  failed: 'Your list could not be loaded. Try again in a moment.',
  notAdded: 'That could not be added. Try again.',
  notChanged: 'That could not be changed. Try again.',
  calendar: 'Calendar',
  all: 'All tasks, filters and analytics',
} as const;

type SectionKey = keyof typeof COPY.sections;

/** Which part of the list a task sits in. Pure. */
export function sectionOf(task: Pick<ListTask, 'dueDay'>, today: string): SectionKey {
  if (!task.dueDay) {
    return 'someday';
  }
  return task.dueDay < today ? 'late' : task.dueDay === today ? 'today' : 'soon';
}

const ORDER: SectionKey[] = ['late', 'today', 'soon', 'someday'];

export default function MyListView() {
  const [page, setPage] = useState<TaskListPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_ROUTES.PLANNER_TASKS.BASE}?zone=${encodeURIComponent(browserTimeZone())}`
      );
      const json = (await res.json()) as { data?: TaskListPage };
      if (!res.ok || !json.data) {
        throw new Error('list not loaded');
      }
      setPage(json.data);
      setFailed(false);
    } catch (error) {
      logger.error('task list load failed', error, 'MyListView');
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = page?.today ?? browserToday();
  const sections = useMemo(
    () =>
      ORDER.map(key => ({
        key,
        tasks: (page?.tasks ?? []).filter(t => sectionOf(t, today) === key),
      })).filter(s => s.tasks.length > 0),
    [page, today]
  );

  async function add(entry: Parsed): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.PLANNER_TASKS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: entry.title, day: entry.day, zone: browserTimeZone() }),
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

  async function done(task: ListTask) {
    // Gone at once: the tap is the whole gesture. It comes back if the server refused.
    setPage(p => (p ? { ...p, tasks: p.tasks.filter(t => t.id !== task.id) } : p));
    const res = await fetch(API_ROUTES.PLANNER_TASKS.DONE(task.id), { method: 'POST' }).catch(
      () => null
    );
    if (!res?.ok) {
      toast.error(COPY.notChanged);
      await load();
    }
  }

  async function move(task: ListTask, day: string | null) {
    setMoving(null);
    setPage(p =>
      p ? { ...p, tasks: p.tasks.map(t => (t.id === task.id ? { ...t, dueDay: day } : t)) } : p
    );
    const res = await fetch(API_ROUTES.PLANNER_TASKS.BY_ID(task.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, zone: browserTimeZone() }),
    }).catch(() => null);
    if (!res?.ok) {
      toast.error(COPY.notChanged);
      await load();
    }
  }

  return (
    <EntityListShell
      title={COPY.title}
      description={COPY.description}
      headerActions={
        <Link
          href={ROUTES.DASHBOARD.CALENDAR}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-default px-4 text-sm text-fg-primary hover:bg-surface-raised"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {COPY.calendar}
        </Link>
      }
    >
      <div className="oc-planner mx-auto flex max-w-2xl flex-col gap-8">
        <QuickAdd kind="task" today={today} copy={COPY.quick} busy={busy} onAdd={add} />

        {failed && (
          <p role="alert" className="mb-0 text-sm text-status-negative">
            {COPY.failed}
          </p>
        )}
        {!failed && !page && (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-raised" />
            ))}
          </div>
        )}
        {page && page.tasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListChecks className="h-10 w-10 text-fg-tertiary" aria-hidden="true" />
            <p className="mb-0 text-lg font-semibold text-fg-primary">{COPY.emptyTitle}</p>
            <p className="mb-0 max-w-sm text-base text-fg-secondary">{COPY.empty}</p>
          </div>
        )}
        {sections.map(section => (
          <section key={section.key} aria-label={COPY.sections[section.key]}>
            <h2
              className={`mb-2 px-1 text-sm font-semibold ${
                section.key === 'late' ? 'text-status-negative' : 'text-fg-secondary'
              }`}
            >
              {COPY.sections[section.key]} · {section.tasks.length}
            </h2>
            <ul className="overflow-hidden rounded-2xl border border-default bg-surface-base">
              {section.tasks.map(task => (
                <li key={task.id} className="border-b border-subtle last:border-b-0">
                  <div className="flex items-center gap-1 pr-3">
                    <button
                      type="button"
                      aria-label={COPY.done(task.title)}
                      onClick={() => void done(task)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:text-status-positive"
                    >
                      <Circle className="h-6 w-6" aria-hidden="true" />
                    </button>
                    <span className="min-w-0 flex-1 py-3">
                      <span className="block truncate text-base text-fg-primary">{task.title}</span>
                      {task.isReminder && (
                        <span className="block text-sm text-fg-secondary">{COPY.reminder}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={COPY.move(task.title)}
                      aria-expanded={moving === task.id}
                      onClick={() => setMoving(m => (m === task.id ? null : task.id))}
                      className={`min-h-11 shrink-0 rounded-full border border-subtle px-3 text-sm hover:bg-surface-raised ${
                        section.key === 'late' ? 'text-status-negative' : 'text-fg-secondary'
                      }`}
                    >
                      {task.dueDay ? dayChip(task.dueDay, today) : COPY.noDate}
                    </button>
                  </div>
                  {moving === task.id && (
                    <div className="px-4 pb-3">
                      <DayStrip
                        label={COPY.quick.when}
                        today={today}
                        days={7}
                        locale={APP_LOCALE}
                        value={task.dueDay}
                        allowClear
                        otherDateLabel={COPY.quick.otherDate}
                        onChange={next => void move(task, next.date)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Link
          href={`${ROUTES.DASHBOARD.TASKS}?view=all`}
          className="self-start text-sm text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
        >
          {COPY.all}
        </Link>
      </div>
    </EntityListShell>
  );
}
