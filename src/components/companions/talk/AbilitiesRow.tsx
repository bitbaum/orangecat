'use client';

/**
 * The row in a bot's details where its owner says what it may do: each
 * ability off, asked first, or on its own. Opens inline under the row, like
 * the routine. A change is saved at once and the list shows what the server
 * stored; an ability that needs a Cat permission first says so and links to
 * where it is given.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import type { HandMode } from '@/services/companions/hand-grants';
import type { HandRow } from '@/services/companions/hand-rows';
import { logger } from '@/utils/logger';
import { DetailRow } from './TalkDetailsSheet';

interface Envelope {
  data?: { hands: HandRow[] };
  error?: { message?: string };
}

export function AbilitiesRow({ assistantId }: { assistantId: string }) {
  const copy = COMPANION_COPY.talk.abilities;
  const [hands, setHands] = useState<HandRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.HANDS(assistantId));
      const json = (await res.json()) as Envelope;
      if (res.ok && json.data) {
        setHands(json.data.hands);
      }
    } catch (err) {
      logger.error('abilities load failed', err, 'AbilitiesRow');
    }
  }, [assistantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(actionId: string, mode: HandMode) {
    setBusy(actionId);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.HANDS(assistantId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, mode }),
      });
      const json = (await res.json()) as Envelope;
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message || copy.failed);
      }
      setHands(json.data.hands);
    } catch (err) {
      logger.error('ability save failed', err, 'AbilitiesRow');
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setBusy(null);
    }
  }

  const own = hands.filter(h => h.mode === 'auto').length;

  return (
    <>
      <DetailRow onClick={() => setOpen(v => !v)}>
        {own > 0 ? copy.rowOwn(own) : copy.row}
      </DetailRow>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          <p className="mb-0 text-sm text-fg-secondary">{copy.intro}</p>
          <ul className="flex flex-col gap-2">
            {hands.map(hand => (
              <li key={hand.id} className="flex flex-col gap-1">
                <label className="flex min-h-[44px] items-center justify-between gap-3 text-base text-fg-primary">
                  <span className="min-w-0 flex-1">{copy.labels[hand.id] ?? hand.name}</span>
                  <select
                    value={hand.mode}
                    disabled={busy === hand.id}
                    onChange={e => void change(hand.id, e.target.value as HandMode)}
                    className="min-h-[44px] shrink-0 rounded-xl border border-subtle bg-surface-raised px-3 text-base text-fg-primary"
                  >
                    <option value="off">{copy.off}</option>
                    <option value="ask">{copy.ask}</option>
                    {hand.canAuto && (
                      <option value="auto" disabled={!hand.available}>
                        {copy.auto}
                      </option>
                    )}
                  </select>
                </label>
                {hand.canAuto && !hand.available && (
                  <span className="block text-sm text-fg-secondary">
                    {copy.needsPermission}{' '}
                    <a
                      href={ROUTES.DASHBOARD.CAT_PERMISSIONS_CATEGORY(hand.category)}
                      className="underline underline-offset-2"
                    >
                      {copy.allow}
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {error && <p className="mb-0 text-sm text-status-negative">{error}</p>}
        </div>
      )}
    </>
  );
}
