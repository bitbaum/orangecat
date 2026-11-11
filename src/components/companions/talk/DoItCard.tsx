'use client';

/**
 * "Do it?" under a bot's answer: the Cat's own consent card for what the bot
 * proposed, and after the tap the one line that says what happened, with a
 * link when the thing has a page. The confirm and the reject are the Cat's
 * (usePendingActions → /api/cat/actions), so a bot can do nothing the Cat
 * could not, and a standing grant given here holds for the Cat too.
 */

import Link from 'next/link';
import { useState } from 'react';
import { PendingActionsCard } from '@/components/ai-chat/PendingActionsCard';
import { usePendingActions, type PendingAction } from '@/components/ai-chat/usePendingActions';
import { COMPANION_COPY } from '@/config/companions';

export function DoItCard({
  action,
  onDone,
  onOutcome,
}: {
  action: PendingAction;
  onDone: () => void;
  /** The action ran (well or not): the thread now holds its outcome line. */
  onOutcome?: () => void;
}) {
  const { confirmAction, rejectAction } = usePendingActions();
  const [outcome, setOutcome] = useState<{ text: string; url?: string } | null>(null);
  const copy = COMPANION_COPY.talk.hands;

  if (outcome) {
    return (
      <p className="mb-2 flex items-center gap-2 rounded-2xl border border-subtle bg-surface-raised p-3 text-sm text-fg-primary">
        <span className="min-w-0 flex-1">
          {outcome.text}
          {outcome.url && (
            <>
              {' '}
              <Link href={outcome.url} className="underline underline-offset-2">
                {copy.open}
              </Link>
            </>
          )}
        </span>
        <button
          type="button"
          className="min-h-[44px] shrink-0 px-2 text-fg-secondary"
          aria-label={copy.dismiss}
          onClick={onDone}
        >
          ×
        </button>
      </p>
    );
  }

  return (
    <div className="mb-2">
      <PendingActionsCard
        action={action}
        onConfirm={async id => {
          // A card that ran and failed is finished too: the reason becomes the
          // outcome line. Left as a card, its Confirm would run an action that
          // is no longer pending (seen live 2026-11-01, the Loki ask of an
          // account not linked to Loki).
          try {
            const result = await confirmAction(id);
            setOutcome({ text: result.message ?? copy.done, url: result.url });
            return result;
          } catch (error) {
            setOutcome({ text: error instanceof Error ? error.message : copy.failed });
            return {};
          } finally {
            onOutcome?.();
          }
        }}
        onReject={async id => {
          await rejectAction(id);
          onDone();
        }}
      />
    </div>
  );
}
