'use client';

/**
 * The one row in a bot's details that makes it write first: a time of day,
 * what it is asked, Save or Stop. Opens inline, under the row, so the
 * details sheet stays the one place the bot is set up. Says plainly when
 * the routine cannot run (no own key) and offers the way to add one.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import { ROUTINE_INTERVALS, type Routine } from '@/services/companions/routines-store';
import { logger } from '@/utils/logger';
import { DetailRow } from './TalkDetailsSheet';

interface Envelope {
  data?: { routine: Routine | null; canRun: boolean };
  error?: { message?: string };
}

export function RoutineRow({ assistantId }: { assistantId: string }) {
  const copy = COMPANION_COPY.talk.routine;
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [canRun, setCanRun] = useState(true);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState('08:00');
  const [everyHours, setEveryHours] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<string>(copy.defaultPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.ROUTINE(assistantId));
      const json = (await res.json()) as Envelope;
      if (res.ok && json.data) {
        setRoutine(json.data.routine);
        setCanRun(json.data.canRun);
        if (json.data.routine) {
          setTime(json.data.routine.timeLocal);
          setEveryHours(json.data.routine.everyHours);
          setPrompt(json.data.routine.prompt);
        }
      }
    } catch (err) {
      logger.error('routine load failed', err, 'RoutineRow');
    }
  }, [assistantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.ROUTINE(assistantId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, timeLocal: time, zone, everyHours }),
      });
      const json = (await res.json()) as Envelope;
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message || copy.failed);
      }
      setRoutine(json.data.routine);
      setCanRun(json.data.canRun);
      setOpen(false);
    } catch (err) {
      logger.error('routine save failed', err, 'RoutineRow');
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(API_ROUTES.AI_ASSISTANTS.ROUTINE(assistantId), { method: 'DELETE' });
      setRoutine(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DetailRow onClick={() => setOpen(v => !v)}>
        {routine
          ? routine.everyHours
            ? copy.setEvery(routine.everyHours)
            : copy.set(routine.timeLocal)
          : copy.row}
      </DetailRow>
      {open && (
        <form
          className="flex flex-col gap-3 px-4 pb-3"
          onSubmit={e => {
            e.preventDefault();
            void save();
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
              maxLength={500}
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
          {routine?.skippedReason && canRun === false && (
            <p className="mb-0 text-sm text-status-negative">{copy.skipped}</p>
          )}
          {error && <p className="mb-0 text-sm text-status-negative">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy || !prompt.trim()}>
              {busy ? copy.saving : copy.save}
            </Button>
            {routine && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void remove()}
              >
                {copy.remove}
              </Button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
