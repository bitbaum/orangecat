'use client';

/**
 * The row in a bot's details where its owner writes the rules ALL their bots
 * follow, and sets their time zone. One set per person, shown in every bot of
 * theirs. What the rules do is services/companions/rules.ts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { DetailRow } from './TalkDetailsSheet';

interface Envelope {
  data?: { rules: string | null; timeZone: string | null };
}

function zones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

export function RulesRow() {
  const copy = COMPANION_COPY.talk.rules;
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState('');
  const [zone, setZone] = useState('');
  const [has, setHas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const allZones = useMemo(() => zones(), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.RULES);
      const json = (await res.json()) as Envelope;
      if (res.ok && json.data) {
        setRules(json.data.rules ?? '');
        setHas(Boolean(json.data.rules));
        // Nothing saved yet: offer this device's zone, saved only on Save.
        setZone(json.data.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
      }
    } catch (err) {
      logger.error('bot rules load failed', err, 'RulesRow');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.RULES, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, timeZone: zone || null }),
      });
      const json = (await res.json()) as Envelope;
      if (!res.ok || !json.data) {
        throw new Error(copy.failed);
      }
      setHas(Boolean(json.data.rules));
      setNote({ ok: true, text: copy.saved });
    } catch (err) {
      logger.error('bot rules save failed', err, 'RulesRow');
      setNote({ ok: false, text: copy.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DetailRow onClick={() => setOpen(v => !v)}>{has ? copy.rowSet : copy.row}</DetailRow>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          <p className="mb-0 text-sm text-fg-secondary">{copy.intro}</p>
          <label className="flex flex-col gap-1 text-sm text-fg-secondary">
            <span>{copy.label}</span>
            <textarea
              value={rules}
              onChange={e => setRules(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={copy.placeholder}
              className="w-full rounded-xl border border-subtle bg-surface-raised p-3 text-base text-fg-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-fg-secondary">
            <span>{copy.zone}</span>
            <select
              value={zone}
              onChange={e => setZone(e.target.value)}
              className="min-h-[44px] rounded-xl border border-subtle bg-surface-raised px-3 text-base text-fg-primary"
            >
              <option value="">{copy.zoneNone}</option>
              {zone && !allZones.includes(zone) && <option value={zone}>{zone}</option>}
              {allZones.map(z => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              {copy.save}
            </Button>
            {note && (
              <span className={`text-sm ${note.ok ? 'text-fg-secondary' : 'text-status-negative'}`}>
                {note.text}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
