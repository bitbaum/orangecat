'use client';

/**
 * The row above the message box of your own bot: what it can set in motion,
 * one tap each. A chip writes the start of the sentence into the box; the
 * person finishes it and sends. Only abilities switched on for this bot get
 * a chip, so a chip never offers what its owner switched off.
 */

import { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import type { HandRow } from '@/services/companions/hand-rows';
import { logger } from '@/utils/logger';

export interface SuggestionChip {
  label: string;
  draft: string;
}

/** The chips whose ability the owner left on, in their written order. */
export function chipsFor(hands: ReadonlyArray<Pick<HandRow, 'id' | 'mode'>>): SuggestionChip[] {
  const on = new Set(hands.filter(h => h.mode !== 'off').map(h => h.id));
  return COMPANION_COPY.talk.chips.items
    .filter(c => on.has(c.hand))
    .map(({ label, draft }) => ({ label, draft }));
}

/** The chips for one of the person's own bots; none for anyone else's (null). */
export function useSuggestionChips(assistantId: string | null): SuggestionChip[] {
  const [chips, setChips] = useState<SuggestionChip[]>([]);
  useEffect(() => {
    if (!assistantId) {
      return;
    }
    let live = true;
    fetch(API_ROUTES.AI_ASSISTANTS.HANDS(assistantId))
      .then(async res => {
        const json = (await res.json()) as { data?: { hands?: HandRow[] } };
        if (live && res.ok && json.data?.hands) {
          setChips(chipsFor(json.data.hands));
        }
      })
      .catch(err => logger.error('chips load failed', err, 'SuggestionChips'));
    return () => {
      live = false;
    };
  }, [assistantId]);
  return assistantId ? chips : [];
}

export function SuggestionChips({
  chips,
  onPick,
}: {
  chips: readonly SuggestionChip[];
  onPick: (draft: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={COMPANION_COPY.talk.chips.label}
      className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]"
    >
      {chips.map(chip => (
        <button
          key={chip.label}
          type="button"
          onClick={() => onPick(chip.draft)}
          className="min-h-[44px] flex-none rounded-full border border-subtle bg-surface-raised px-4 text-sm text-fg-primary hover:bg-surface-hover"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
