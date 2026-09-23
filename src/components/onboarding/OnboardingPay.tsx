'use client';

import { WalletPasteField } from '@/components/create/wallet-selector/WalletPasteField';
import { RECEIVE_COPY } from '@/config/receive';

interface OnboardingPayProps {
  profileId: string | undefined;
  onDone: () => void;
}

/**
 * After "who are you", one optional paste. Skip continues into the Cat.
 * Same box as Receive — not a second wallet form.
 */
export function OnboardingPay({ profileId, onDone }: OnboardingPayProps) {
  return (
    <WalletPasteField
      profileId={profileId}
      defaultLabel="Main"
      hideIntro
      submitLabel="Save"
      cancelLabel={RECEIVE_COPY.notNow}
      onCancel={onDone}
      onSaved={onDone}
    />
  );
}
