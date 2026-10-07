'use client';

/**
 * Weekly availability editor — pick the days you're available + the hours.
 * Used as the 'availability' field type in the entity form (services).
 * Emits the shared AvailabilitySchedule ({ days, hours }); people see it on the
 * public page before booking. v1 uses a single hours range applied to all days.
 *
 * Hours are on the provider's clock, so the schedule carries its zone. The
 * editor used to rebuild `{ days, hours }` on every change, dropping any zone
 * already stored, and the public page printed "09:00–17:00" with no clock —
 * a visitor elsewhere read the provider's hours as their own (audit 2026-10-07).
 */

import { WEEKDAYS, parseAvailability, type AvailabilitySchedule } from '@/lib/availability';
import { browserTimeZone, zoneLabel } from '@/utils/timezone';

interface AvailabilityEditorProps {
  value: unknown;
  onChange: (value: AvailabilitySchedule) => void;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

export function AvailabilityEditor({ value, onChange }: AvailabilityEditorProps) {
  const current = parseAvailability(value);
  const selectedDays = new Set(current.days ?? []);
  const range = current.hours?.[0] ?? { start: DEFAULT_START, end: DEFAULT_END };
  const timezone = current.timezone ?? browserTimeZone();

  const emit = (next: AvailabilitySchedule) => {
    // Only keep hours when at least one day is selected, so an empty schedule
    // round-trips to "no availability set".
    const days = next.days ?? [];
    onChange(days.length ? { days, hours: next.hours ?? [range], timezone } : {});
  };

  const toggleDay = (day: (typeof WEEKDAYS)[number]['key'], on: boolean) => {
    const days = new Set(selectedDays);
    if (on) {
      days.add(day);
    } else {
      days.delete(day);
    }
    emit({ days: Array.from(days), hours: [range] });
  };

  const setTime = (field: 'start' | 'end', time: string) => {
    emit({ days: Array.from(selectedDays), hours: [{ ...range, [field]: time }] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map(({ key, short }) => {
          const on = selectedDays.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(key, !on)}
              aria-pressed={on}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                on
                  ? 'border-interactive/60 bg-surface-raised/60 text-fg-primary'
                  : 'border-subtle text-fg-secondary hover:bg-surface-raised/30'
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>

      {selectedDays.size > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-fg-secondary">Hours</span>
          <input
            type="time"
            value={range.start}
            onChange={e => setTime('start', e.target.value)}
            className="rounded-md border border-subtle bg-surface-base px-2 py-1 text-sm text-fg-primary"
            aria-label="Available from"
          />
          <span className="text-fg-tertiary">–</span>
          <input
            type="time"
            value={range.end}
            onChange={e => setTime('end', e.target.value)}
            className="rounded-md border border-subtle bg-surface-base px-2 py-1 text-sm text-fg-primary"
            aria-label="Available until"
          />
          {range.start >= range.end && (
            <span className="text-xs text-status-negative">End must be after start</span>
          )}
        </div>
      )}
      {selectedDays.size > 0 && <p className="text-xs text-fg-tertiary">{zoneLabel(timezone)}</p>}
    </div>
  );
}
