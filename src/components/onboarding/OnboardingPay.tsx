'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { WalletPasteField } from '@/components/create/wallet-selector/WalletPasteField';
import Button from '@/components/ui/Button';
import { RECEIVE_COPY } from '@/config/receive';

interface OnboardingPayProps {
  profileId: string | undefined;
  /** Offer generation is in flight. The paste stays mounted in state, not on screen. */
  busy?: boolean;
  /** Set when generation failed. A saved destination must not be asked for again. */
  error?: string | null;
  onChat?: () => void;
  onDone: () => void | Promise<void>;
}

/**
 * After "who are you", one optional paste. Skip continues into the Cat.
 * Same box as Receive — not a second wallet form.
 */
export function OnboardingPay({
  profileId,
  busy = false,
  error = null,
  onChat,
  onDone,
}: OnboardingPayProps) {
  const [saved, setSaved] = useState(false);

  if (busy) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-6 text-sm text-fg-secondary"
      >
        <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
        Reading you, finding offers…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-status-negative">{error}</p>}
      {saved && error && (
        <Button variant="accent" className="w-full" onClick={() => void onDone()}>
          Try again
        </Button>
      )}
      {error && onChat && (
        <button
          type="button"
          onClick={onChat}
          className="min-h-11 w-full text-center text-sm text-fg-secondary transition-colors hover:text-fg-primary"
        >
          Or just chat with your Cat instead →
        </button>
      )}
      {!saved && (
        <WalletPasteField
          profileId={profileId}
          defaultLabel="Main"
          hideIntro
          submitLabel="Save"
          cancelLabel={RECEIVE_COPY.notNow}
          onCancel={() => void onDone()}
          onSaved={() => {
            setSaved(true);
            void onDone();
          }}
        />
      )}
    </div>
  );
}
