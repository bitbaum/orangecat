'use client';

/**
 * One line, said or typed, and taps for the rest.
 *
 * "Dentist Monday 9am at Chur": the line is read as it is written
 * (services/planner/quick-add.ts) and what it found shows as the selected
 * chips underneath: the day, the time, how long. A tap changes any of them,
 * so nobody types a date or opens a date field. The line has a microphone
 * (chatkit's DictationField); the chips are whenkit's.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { DictationField } from '@bitbaum/chatkit/react';
import { formatLength, formatTime, type ISODate, type WallTime } from '@bitbaum/whenkit';
import { ChipGroup, DayStrip } from '@bitbaum/whenkit/react';
import '@bitbaum/chatkit/styles.css';
import '@bitbaum/whenkit/styles.css';
import Button from '@/components/ui/Button';
import { CHAT_VOICE } from '@/hooks/useDictation';
import { parseQuickAdd, type QuickAdd as Parsed } from '@/services/planner/quick-add';
import { APP_LOCALE } from '@/utils/locale';

const ALL_DAY = 'all-day';
/** The hours people start things at; a time said in the line joins them. */
const HOURS: WallTime[] = Array.from(
  { length: 15 },
  (_, i) => `${String(i + 7).padStart(2, '0')}:00`
);
const LENGTHS = [30, 60, 90, 120];

export interface QuickAddCopy {
  label: string;
  placeholder: string;
  when: string;
  time: string;
  allDay: string;
  length: string;
  add: string;
  adding: string;
  /** Tasks only: the chip that clears the day. */
  otherDate: string;
}

export function QuickAdd({
  kind,
  today,
  copy,
  busy,
  onAdd,
  initialDay = null,
  initialTime = null,
  autoFocus = false,
}: {
  /** A calendar entry has a time and a length; a task has at most a day. */
  kind: 'calendar' | 'task';
  today: ISODate;
  copy: QuickAddCopy;
  busy: boolean;
  /** Resolves true when it was added, and the line clears. */
  onAdd: (entry: Parsed) => Promise<boolean>;
  /** The day and hour tapped to get here, used until the line says otherwise. */
  initialDay?: ISODate | null;
  initialTime?: WallTime | null;
  autoFocus?: boolean;
}) {
  const [line, setLine] = useState('');
  // What a tap chose. `undefined` follows the line; a tap wins until the line is sent.
  const [day, setDay] = useState<ISODate | null | undefined>(undefined);
  const [time, setTime] = useState<WallTime | null | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);

  const read = useMemo(() => parseQuickAdd(line, today), [line, today]);
  const entry: Parsed = {
    ...read,
    day: day === undefined ? (read.day ?? initialDay) : day,
    time: time === undefined ? (read.time ?? initialTime) : time,
    minutes: minutes ?? read.minutes,
  };
  const ready = entry.title.length > 0 && !busy;

  const times = useMemo(
    () => (entry.time && !HOURS.includes(entry.time) ? [...HOURS, entry.time].sort() : HOURS),
    [entry.time]
  );

  // The chosen start time is brought into view: nine in the morning said in
  // the line would otherwise be selected just off the edge of the row.
  const timesRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    timesRow.current
      ?.querySelector<HTMLElement>('[data-selected]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [entry.time]);

  async function add() {
    if (!ready) {
      return;
    }
    const sent: Parsed =
      kind === 'calendar'
        ? { ...entry, day: entry.day ?? today }
        : { ...entry, time: null, minutes: null };
    if (await onAdd(sent)) {
      setLine('');
      setDay(undefined);
      setTime(undefined);
      setMinutes(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default bg-surface-base p-4">
      <DictationField
        value={line}
        onValueChange={setLine}
        ariaLabel={copy.label}
        placeholder={copy.placeholder}
        multiline={false}
        maxLength={240}
        voice={CHAT_VOICE}
        onSubmit={() => void add()}
        autoFocus={autoFocus}
        inputProps={{ enterKeyHint: 'done', autoComplete: 'off' }}
      />
      <DayStrip
        label={copy.when}
        today={today}
        days={kind === 'task' ? 7 : 14}
        locale={APP_LOCALE}
        value={entry.day}
        allowClear={kind === 'task'}
        otherDateLabel={copy.otherDate}
        onChange={next => setDay(next.date)}
      />
      {kind === 'calendar' && (
        <>
          <div ref={timesRow}>
            <ChipGroup<string>
              label={copy.time}
              className="oc-planner-times"
              options={[
                { value: ALL_DAY, label: copy.allDay },
                ...times.map(t => ({ value: t, label: formatTime(t, APP_LOCALE) })),
              ]}
              value={entry.time ?? ALL_DAY}
              onChange={value => setTime(value === ALL_DAY ? null : value)}
            />
          </div>
          {entry.time && (
            <ChipGroup<number>
              label={copy.length}
              options={LENGTHS.map(m => ({ value: m, label: formatLength(m, APP_LOCALE) }))}
              value={entry.minutes}
              onChange={setMinutes}
            />
          )}
        </>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!ready}
        onClick={() => void add()}
        className="w-full sm:w-auto sm:self-start"
      >
        {busy ? copy.adding : copy.add}
      </Button>
    </div>
  );
}
