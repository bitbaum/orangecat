'use client';

import { useRouter } from 'next/navigation';
import { WalletPasteField } from '@/components/create/wallet-selector/WalletPasteField';
import { MoneyPage, MoneyPrompt } from '@/components/money/MoneyPage';
import { PAYMENT_METHODS_COPY } from '@/config/payment-methods';
import { RECEIVE_COPY } from '@/config/receive';
import { ROUTES } from '@/config/routes';

interface ReceiveSetupProps {
  profileId: string | undefined;
  onConnected: () => void;
  /** The other door in: list a Twint, PayPal or bank instead of a Bitcoin wallet. */
  onAddOtherWay?: () => void;
}

/**
 * First way to be paid, on the page whose job is getting paid.
 * Skip leaves the rest of OrangeCat usable. Nothing here is required to look around.
 */
export function ReceiveSetup({ profileId, onConnected, onAddOtherWay }: ReceiveSetupProps) {
  const router = useRouter();

  // The same frame as the code it becomes: title and tabs stay put, the
  // question is the content's heading, and the form sits on the page itself.
  return (
    <MoneyPage title={RECEIVE_COPY.title} subtitle={RECEIVE_COPY.subtitle}>
      <MoneyPrompt heading={RECEIVE_COPY.noWalletTitle} body={RECEIVE_COPY.noWalletBody}>
        <WalletPasteField
          profileId={profileId}
          defaultLabel="Main"
          hideIntro
          bare
          submitLabel={RECEIVE_COPY.saveWallet}
          cancelLabel={RECEIVE_COPY.notNow}
          onCancel={() => router.push(ROUTES.DASHBOARD.CAT)}
          onSaved={onConnected}
        />
      </MoneyPrompt>
      {onAddOtherWay && (
        <button
          type="button"
          onClick={onAddOtherWay}
          className="mt-4 flex min-h-11 w-full items-center justify-center text-sm text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
        >
          {PAYMENT_METHODS_COPY.add}
        </button>
      )}
    </MoneyPage>
  );
}
