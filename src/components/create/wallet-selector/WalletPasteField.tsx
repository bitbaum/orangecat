'use client';

import { WalletForm } from '@/components/wallets/WalletManager/components/WalletForm';
import { WhyReceive } from '@/components/wallets/WhyReceive';
import { createProfileWallet } from '@/services/wallets/createProfileWallet';
import type { Wallet } from '@/types/wallet';

interface WalletPasteFieldProps {
  profileId: string | undefined;
  defaultLabel: string;
  /** Parent already showed the question, so the form's own heading would repeat it. */
  hideIntro?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onSaved: (wallet: Wallet) => void;
}

/**
 * The one paste box. Saves a real wallet row (not loose address columns) and
 * hands that row back so the caller can link it.
 */
export function WalletPasteField({
  profileId,
  defaultLabel,
  hideIntro = false,
  submitLabel = 'Save',
  cancelLabel,
  onCancel,
  onSaved,
}: WalletPasteFieldProps) {
  if (!profileId) {
    return (
      <p className="text-sm text-fg-secondary">
        Sign in again to add a place for people to pay you.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <WhyReceive />
      <WalletForm
        hideIntro={hideIntro}
        defaultLabel={defaultLabel}
        submitLabel={submitLabel}
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        onSubmit={async data => {
          const wallet = await createProfileWallet(profileId, data);
          onSaved(wallet);
        }}
      />
    </div>
  );
}
