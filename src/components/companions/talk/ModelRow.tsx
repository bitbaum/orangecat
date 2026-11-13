'use client';

/**
 * The row in a bot's details where the person picks the model its answers
 * come from. On their own key the list is the provider's own; on the shared
 * pool there is nothing to pick, and the row says how to get a choice.
 *
 * The choice is kept on this device, per bot, and rides each message
 * (useCompanionTalk reads it): nothing is saved on the bot, so a bot's owner
 * and a visitor each choose for themselves.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import type { ModelChoices } from '@/services/ai/own-models';
import { logger } from '@/utils/logger';
import { DetailRow } from './TalkDetailsSheet';
import { readChosenModel, writeChosenModel } from './chosen-model';

interface Envelope {
  data?: ModelChoices;
}

export function ModelRow({ assistantId }: { assistantId: string }) {
  const copy = COMPANION_COPY.talk.model;
  const [choices, setChoices] = useState<ModelChoices | null>(null);
  const [chosen, setChosen] = useState<string>('auto');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setChosen(readChosenModel(assistantId) ?? 'auto');
  }, [assistantId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.MODELS);
      const json = (await res.json()) as Envelope;
      if (res.ok && json.data) {
        setChoices(json.data);
      }
    } catch (err) {
      logger.error('model choices load failed', err, 'ModelRow');
    }
  }, []);

  useEffect(() => {
    if (open && !choices) {
      void load();
    }
  }, [open, choices, load]);

  function change(id: string) {
    setChosen(id);
    writeChosenModel(assistantId, id === 'auto' ? null : id);
  }

  const own = choices?.source === 'own' ? choices : null;
  // A model chosen earlier that this key no longer lists is still shown, so
  // the row never claims "Auto" while a name rides the messages.
  const listed = own?.models ?? [];
  const options =
    chosen !== 'auto' && !listed.some(m => m.id === chosen)
      ? [{ id: chosen, name: chosen }, ...listed]
      : listed;

  return (
    <>
      <DetailRow onClick={() => setOpen(v => !v)}>
        {chosen === 'auto' ? copy.row : copy.rowChosen(chosen)}
      </DetailRow>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          {!choices && <p className="mb-0 text-sm text-fg-secondary">{copy.loading}</p>}
          {choices?.source === 'pool' && (
            <p className="mb-0 text-sm text-fg-secondary">
              {copy.pool}{' '}
              <a href={ROUTES.SETTINGS_AI} className="underline underline-offset-2">
                {copy.addKey}
              </a>
            </p>
          )}
          {own && (
            <label className="flex flex-col gap-1 text-sm text-fg-secondary">
              <span>{copy.pick(own.provider)}</span>
              <select
                value={chosen}
                onChange={e => change(e.target.value)}
                className="min-h-[44px] rounded-xl border border-subtle bg-surface-raised px-3 text-base text-fg-primary"
              >
                <option value="auto">{copy.auto(own.fallback)}</option>
                {options.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </>
  );
}
