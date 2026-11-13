'use client';

/**
 * The rows in a bot's details that make it write first: one per routine
 * (a time or an interval, and what it is asked), and a last row that adds
 * another. Each opens inline, under its row, so the details sheet stays the
 * one place the bot is set up. Says plainly when a routine cannot run (no
 * own key) and offers the way to add one.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import type { Routine, RoutineInput } from '@/services/companions/routines-store';
import { logger } from '@/utils/logger';
import { RoutineForm } from './RoutineForm';
import { DetailRow } from './TalkDetailsSheet';

interface Envelope {
  data?: { routines: Routine[]; canRun: boolean; max: number };
  error?: { message?: string };
}

/** Which form is open: a routine's id, or the one that adds. */
const NEW = 'new';

export function RoutineRow({ assistantId }: { assistantId: string }) {
  const copy = COMPANION_COPY.talk.routine;
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [canRun, setCanRun] = useState(true);
  const [max, setMax] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = API_ROUTES.AI_ASSISTANTS.ROUTINE(assistantId);

  const take = useCallback((data: NonNullable<Envelope['data']>) => {
    setRoutines(data.routines ?? []);
    setCanRun(data.canRun);
    setMax(data.max ?? 1);
  }, []);

  useEffect(() => {
    let live = true;
    fetch(url)
      .then(async res => {
        const json = (await res.json()) as Envelope;
        if (live && res.ok && json.data) {
          take(json.data);
        }
      })
      .catch(err => logger.error('routine load failed', err, 'RoutineRow'));
    return () => {
      live = false;
    };
  }, [url, take]);

  async function save(id: string | null, input: Omit<RoutineInput, 'zone'>) {
    setBusy(true);
    setError(null);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, zone, ...(id ? { id } : {}) }),
      });
      const json = (await res.json()) as Envelope;
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message || copy.failed);
      }
      take(json.data);
      setOpen(null);
    } catch (err) {
      logger.error('routine save failed', err, 'RoutineRow');
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function stop(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${url}?routine=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(copy.failed);
      }
      setRoutines(prev => prev.filter(r => r.id !== id));
      setOpen(null);
    } catch (err) {
      logger.error('routine stop failed', err, 'RoutineRow');
      setError(copy.failed);
    } finally {
      setBusy(false);
    }
  }

  function toggle(key: string) {
    setError(null);
    setOpen(v => (v === key ? null : key));
  }

  const several = routines.length > 1;
  return (
    <>
      {routines.map(r => (
        <div key={r.id} className="flex flex-col">
          <DetailRow onClick={() => toggle(r.id)}>
            <span className="flex min-w-0 flex-1 flex-col py-1">
              <span>{r.everyHours ? copy.setEvery(r.everyHours) : copy.set(r.timeLocal)}</span>
              {several && <span className="truncate text-sm text-fg-secondary">{r.prompt}</span>}
            </span>
          </DetailRow>
          {open === r.id && (
            <RoutineForm
              routine={r}
              canRun={canRun}
              busy={busy}
              error={error}
              onSave={input => void save(r.id, input)}
              onStop={() => void stop(r.id)}
            />
          )}
        </div>
      ))}
      {routines.length < max && (
        <>
          <DetailRow onClick={() => toggle(NEW)}>
            {routines.length === 0 ? copy.row : copy.add}
          </DetailRow>
          {open === NEW && (
            <RoutineForm
              // A fresh form each time one is added, not the last one's words.
              key={routines.length}
              routine={null}
              canRun={canRun}
              busy={busy}
              error={error}
              onSave={input => void save(null, input)}
            />
          )}
        </>
      )}
    </>
  );
}
