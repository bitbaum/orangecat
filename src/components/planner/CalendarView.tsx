'use client';

/**
 * Your calendar: a month, a week or a list, and a microphone. Say "dentist
 * Monday at nine at Chur" and it is in, with Undo; tap a day or an hour to
 * type instead. Your own entries, the tasks and reminders that fall due, and
 * a connected Google calendar, all in your own clock. Your Cat and your bots
 * read and write this same calendar.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { formatTime, type ISODate } from '@bitbaum/whenkit';
import { API_ROUTES } from '@/config/api-routes';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { CalendarPageRow } from '@/services/planner/calendar-page';
import { parseQuickAdd, type QuickAdd as Parsed } from '@/services/planner/quick-add';
import { APP_LOCALE } from '@/utils/locale';
import { browserTimeZone } from '@/utils/timezone';
import { AddSheet } from './calendar/AddSheet';
import { CALENDAR_COPY } from './calendar/copy';
import { DayList } from './calendar/DayList';
import { EventSheet } from './calendar/EventSheet';
import {
  daysFrom,
  monthTitle,
  rangeFor,
  spanTitle,
  step,
  type CalendarMode,
} from './calendar/grid';
import { MonthView } from './calendar/MonthView';
import { PeriodNav } from './calendar/PeriodNav';
import { useCalendarData } from './calendar/useCalendarData';
import { VoiceButton } from './calendar/VoiceButton';
import { WeekView } from './calendar/WeekView';
import { browserToday, dayHeading } from './days';

const MODES = (['month', 'week', 'list'] as const).map(value => ({
  value,
  label: CALENDAR_COPY.modes[value],
}));

export function CalendarView() {
  const isPhone = useMediaQuery('(max-width: 767px)');
  const weekWidth = isPhone ? 3 : 7;
  const [mode, setMode] = useState<CalendarMode>('month');
  const [anchor, setAnchor] = useState<ISODate>(browserToday);
  const [adding, setAdding] = useState<{ day: ISODate; time: string | null } | null>(null);
  const [opened, setOpened] = useState<{ row: CalendarPageRow; day: ISODate } | null>(null);
  const [busy, setBusy] = useState(false);

  const range = rangeFor(mode, anchor, weekWidth);
  const data = useCalendarData(range.from, range.to);
  const today = data.page?.today ?? browserToday();

  const title =
    mode === 'month'
      ? monthTitle(anchor)
      : spanTitle(range.from, mode === 'list' ? range.to : range.to);

  /** Write one entry; on success show it, with Undo. */
  async function add(entry: Parsed): Promise<boolean> {
    const day = entry.day ?? anchor;
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.CALENDAR.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: entry.title,
          start: entry.time ? `${day}T${entry.time}` : day,
          minutes: entry.time ? (entry.minutes ?? 60) : null,
          location: entry.place,
          zone: browserTimeZone(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
      if (!res.ok || !json.data?.id) {
        throw new Error('not added');
      }
      const id = json.data.id;
      setAnchor(day);
      await data.reload();
      const when = `${dayHeading(day, today)}${entry.time ? ` · ${formatTime(entry.time, APP_LOCALE)}` : ''}`;
      toast.success(CALENDAR_COPY.added(`${entry.title} · ${when}`), {
        action: {
          label: CALENDAR_COPY.undo,
          onClick: () => void remove(id, true),
        },
      });
      return true;
    } catch {
      toast.error(CALENDAR_COPY.notAdded);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(entryId: string, quiet = false) {
    setBusy(true);
    const res = await fetch(API_ROUTES.CALENDAR.BY_ID(entryId), { method: 'DELETE' }).catch(
      () => null
    );
    setBusy(false);
    if (!res?.ok) {
      toast.error(CALENDAR_COPY.notRemoved);
      return;
    }
    setOpened(null);
    await data.reload();
    if (!quiet) {
      toast.success(CALENDAR_COPY.remove);
    }
  }

  /** What was said: read it, and add it at once when it says what. */
  function spoken(words: string) {
    const entry = parseQuickAdd(words, today);
    if (!entry.title) {
      toast.error(CALENDAR_COPY.notHeard, {
        action: { label: CALENDAR_COPY.add, onClick: () => setAdding({ day: anchor, time: null }) },
      });
      return;
    }
    void add({ ...entry, day: entry.day ?? anchor });
  }

  const open = (row: CalendarPageRow, day: ISODate) => setOpened({ row, day });

  return (
    <div className="oc-planner mx-auto flex w-full max-w-6xl flex-col gap-4 pb-28">
      <div className="flex items-center gap-2">
        <h1 className="mb-0 mr-auto min-w-0 truncate text-xl font-semibold tracking-display text-fg-primary sm:text-2xl">
          {title}
        </h1>
        <PeriodNav
          onPrevious={() => setAnchor(a => step(mode, a, -1, weekWidth))}
          onToday={() => setAnchor(today)}
          onNext={() => setAnchor(a => step(mode, a, 1, weekWidth))}
        />
      </div>
      <div className="flex items-center gap-2">
        <SegmentedControl
          items={MODES}
          value={mode}
          onChange={setMode}
          label={CALENDAR_COPY.modesLabel}
          className="flex-1 sm:max-w-sm"
        />
        <button
          type="button"
          onClick={() => setAdding({ day: anchor, time: null })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-fg-primary px-4 text-sm font-medium text-fg-inverted"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {CALENDAR_COPY.add}
        </button>
      </div>

      {data.failed && (
        <p role="alert" className="mb-0 text-sm text-status-negative">
          {CALENDAR_COPY.failed}
        </p>
      )}

      {mode === 'month' && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="lg:flex-1">
            <MonthView
              anchor={anchor}
              today={today}
              selected={anchor}
              byDay={data.byDay}
              onSelect={setAnchor}
              onOpen={open}
            />
          </div>
          <div className="lg:w-80">
            <DayList
              days={[anchor]}
              today={today}
              byDay={data.byDay}
              onOpen={open}
              onAdd={day => setAdding({ day, time: null })}
              showEmpty
            />
          </div>
        </div>
      )}
      {mode === 'week' && (
        <WeekView
          days={daysFrom(range.from, weekWidth)}
          today={today}
          zone={data.page?.zone ?? null}
          byDay={data.byDay}
          onOpen={open}
          onAddAt={(day, time) => setAdding({ day, time })}
          onSelectDay={day => {
            setAnchor(day);
            setMode('month');
          }}
        />
      )}
      {mode === 'list' &&
        (data.page && data.page.byDay.length === 0 ? (
          <p className="mb-0 py-10 text-center text-base text-fg-secondary">
            {CALENDAR_COPY.emptyList}
          </p>
        ) : (
          <DayList
            days={daysFrom(range.from, 31)}
            today={today}
            byDay={data.byDay}
            onOpen={open}
            showEmpty={false}
          />
        ))}

      {data.page?.googleNote && (
        <p className="mb-0 text-sm text-fg-secondary">{data.page.googleNote}</p>
      )}
      {data.page?.zone && (
        <p className="mb-0 text-xs text-fg-tertiary">Times in {data.page.zone}.</p>
      )}

      <VoiceButton onSpoken={spoken} />
      <AddSheet
        open={adding !== null}
        today={today}
        day={adding?.day ?? anchor}
        time={adding?.time ?? null}
        busy={busy}
        onClose={() => setAdding(null)}
        onAdd={add}
      />
      <EventSheet
        open={opened !== null}
        row={opened?.row ?? null}
        day={opened?.day ?? null}
        today={today}
        busy={busy}
        onClose={() => setOpened(null)}
        onRemove={id => void remove(id)}
      />
    </div>
  );
}
