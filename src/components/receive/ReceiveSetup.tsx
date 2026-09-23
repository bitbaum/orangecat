'use client';

import { useRouter } from 'next/navigation';
import { WalletPasteField } from '@/components/create/wallet-selector/WalletPasteField';
import { MoneyTabs } from '@/components/money/MoneyTabs';
import { RECEIVE_COPY } from '@/config/receive';
import { ROUTES } from '@/config/routes';

interface ReceiveSetupProps {
  profileId: string | undefined;
  onConnected: () => void;
}

/**
 * First receive rail, on the page whose job is getting paid.
 * Skip leaves the rest of OrangeCat usable. Nothing here is required to look around.
 */
export function ReceiveSetup({ profileId, onConnected }: ReceiveSetupProps) {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-fg-primary">{RECEIVE_COPY.noWalletTitle}</h1>
      <p className="mt-2 text-sm text-fg-secondary">{RECEIVE_COPY.noWalletBody}</p>
      <MoneyTabs className="mt-5" />
      <div className="mt-6">
        <WalletPasteField
          profileId={profileId}
          defaultLabel="Main"
          hideIntro
          submitLabel="Save"
          cancelLabel={RECEIVE_COPY.notNow}
          onCancel={() => router.push(ROUTES.DASHBOARD.CAT)}
          onSaved={onConnected}
        />
      </div>
    </div>
  );
}
