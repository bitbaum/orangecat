'use client';

/**
 * One routine, opened under its row: how often, at what time, what the bot
 * is asked, Save or Stop. The same form adds a routine and changes one.
 */

import { useState } from 'react';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import {
  ROUTINE_INTERVALS,
  ROUTINE_PROMPT_MAX,
  type Routine,
  type RoutineInput,
} from '@/services/companions/routines-store';

export function RoutineForm({
  routine,
  canRun,
  busy,
  error,
  onSave,
  onStop,
}: {
  /** The routine being changed; null = a new one. */
  routine: Routine | null;
  canRun: boolean;
  busy: boolean;
  error: string | null;
  onSave: (input: Omit<RoutineInput, 'zone'>) => void;
  onStop?: () => void;
}) {
  const copy = COMPANION_COPY.talk.routine;
  const [time, setTime] = useState(routine?.timeLocal ?? '08:00');
  const [everyHours, setEveryHours] = useState<number | null>(routine?.everyHours ?? null);
  const [prompt, setPrompt] = useState<string>(routine?.prompt ?? copy.defaultPrompt);

  return (
    <form
      className="flex flex-col gap-3 px-4 pb-3"
      onSubmit={e => {
        e.preventDefault();
        onSave({ prompt, timeLocal: time, everyHours });
      }}
    >
      <label className="flex items-center justify-between gap-3 text-sm text-fg-secondary">
        {copy.how}
        <select
          value={everyHours ?? 0}
          onChange={e => setEveryHours(Number(e.target.value) || null)}
          className="min-h-[44px] rounded-xl border border-subtle bg-surface-raised px-3 text-base text-fg-primary"
        >
          <option value={0}>{copy.daily}</option>
          {ROUTINE_INTERVALS.map(h => (
            <option key={h} value={h}>
              {copy.every(h)}
            </option>
          ))}
        </select>
      </label>
      {everyHours === null && (
        <label className="flex items-center justify-between gap-3 text-sm text-fg-secondary">
          {copy.title}
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="rounded-xl border border-subtle bg-surface-raised px-3 py-2 text-base text-fg-primary"
            required
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm text-fg-secondary">
        {copy.prompt}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          maxLength={ROUTINE_PROMPT_MAX}
          rows={2}
          className="rounded-xl border border-subtle bg-surface-raised px-3 py-2 text-base text-fg-primary"
        />
      </label>
      {!canRun && (
        <p className="mb-0 text-sm text-fg-secondary">
          {copy.needsKey}{' '}
          <a href={ROUTES.SETTINGS_AI} className="underline underline-offset-2">
            {copy.addKey}
          </a>
        </p>
      )}
      {routine?.skippedReason && !canRun && (
        <p className="mb-0 text-sm text-status-negative">{copy.skipped}</p>
      )}
      {error && <p className="mb-0 text-sm text-status-negative">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy || !prompt.trim()}>
          {busy ? copy.saving : copy.save}
        </Button>
        {onStop && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onStop}>
            {copy.remove}
          </Button>
        )}
      </div>
    </form>
  );
}
