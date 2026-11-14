'use client';

/**
 * Your calendar: what is on in the coming days, from every place you keep
 * it. Your own entries (you can add and remove those here), the tasks and
 * reminders that fall due, and your Google calendar if you connected it.
 * Your Cat and your bots read this same list, and write to it when you ask.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import EntityListShell from '@/components/entity/EntityListShell';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRequireAuth } from '@/hooks/useAuth';
import type { CalendarPage, CalendarPageRow } from '@/services/planner/calendar-page';
import { formatIsoDay } from '@/utils/dates';
import { logger } from '@/utils/logger';

const COPY = {
  title: 'Calendar',
  description: 'Your coming days. Your Cat and your bots read this, and add to it when you ask.',
  add: 'Add an entry',
  what: 'What',
  when: 'When',
  until: 'Until (optional)',
  where: 'Where (optional)',
  save: 'Add to calendar',
  saving: 'Adding…',
  remove: 'Remove',
  empty:
    'Nothing in the next 30 days. Add an entry here, or tell your Cat: "put dentist on Monday at 9 in my calendar".',
  failed: 'Your calendar could not be loaded. Try again in a moment.',
  notAdded: 'That could not be added. Check the time and try again.',
  notRemoved: 'That could not be removed. Try again.',
  tasks: 'Open your to-do list',
} as const;

/** What a row is, when it is not one of your own entries. */
const SOURCE_WORD: Record<CalendarPageRow['source'], string | null> = {
  calendar: null,
  task: 'Task due',
  reminder: 'Reminder',
  google: 'Google calendar',
};

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function CalendarPageView() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [page, setPage] = useState<CalendarPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_ROUTES.CALENDAR.BASE}?days=30&zone=${encodeURIComponent(browserZone())}`
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
    if (user) {
      void load();
    }
  }, [user, load]);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.CALENDAR.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          start,
          end: end || null,
          location: location || null,
          zone: browserZone(),
        }),
      });
      if (!res.ok) {
        throw new Error('not added');
      }
      setTitle('');
      setStart('');
      setEnd('');
      setLocation('');
      await load();
    } catch {
      toast.error(COPY.notAdded);
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

  if (authLoading || !user) {
    return <Loading fullScreen message="Loading your calendar..." />;
  }

  const field = 'flex flex-col gap-1 text-sm text-fg-secondary';
  return (
    <EntityListShell title={COPY.title} description={COPY.description}>
      <form
        className="mb-8 grid gap-3 rounded-lg border border-default bg-surface-base p-4 sm:grid-cols-2"
        aria-label={COPY.add}
        onSubmit={e => {
          e.preventDefault();
          void add();
        }}
      >
        <label className={`${field} sm:col-span-2`}>
          {COPY.what}
          <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <label className={field}>
          {COPY.when}
          <Input
            type="datetime-local"
            value={start}
            onChange={e => setStart(e.target.value)}
            required
          />
        </label>
        <label className={field}>
          {COPY.until}
          <Input
            type="datetime-local"
            value={end}
            min={start}
            onChange={e => setEnd(e.target.value)}
          />
        </label>
        <label className={`${field} sm:col-span-2`}>
          {COPY.where}
          <Input value={location} onChange={e => setLocation(e.target.value)} maxLength={300} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={busy || !title.trim() || !start}>
            {busy ? COPY.saving : COPY.save}
          </Button>
        </div>
      </form>

      {failed && (
        <p role="alert" className="mb-0 text-sm text-status-negative">
          {COPY.failed}
        </p>
      )}
      {!failed && !page && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-raised" />
          ))}
        </div>
      )}
      {page && page.byDay.length === 0 && (
        <p className="mb-0 text-base text-fg-secondary">{COPY.empty}</p>
      )}
      {page?.byDay.map(day => (
        <section key={day.day} className="mb-6" aria-label={formatIsoDay(day.day)}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-tertiary">
            {formatIsoDay(day.day)}
          </h2>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-default bg-surface-base">
            {day.rows.map((row, i) => (
              <li key={`${row.entryId ?? row.title}-${i}`} className="flex items-center gap-3 p-3">
                <span className="w-28 shrink-0 text-sm tabular-nums text-fg-secondary">
                  {row.time}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => void remove(row.entryId as string)}
                  >
                    {COPY.remove}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {page?.googleNote && <p className="mb-4 text-sm text-fg-secondary">{page.googleNote}</p>}
      {page?.zone && <p className="mb-4 text-xs text-fg-tertiary">Times in {page.zone}.</p>}
      <Link
        href={ROUTES.DASHBOARD.TASKS}
        className="text-sm text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
      >
        {COPY.tasks}
      </Link>
    </EntityListShell>
  );
}
