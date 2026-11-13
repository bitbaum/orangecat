'use client';

import { Button } from '@/components/ui/Button';
import { MoneyPrompt } from '@/components/money/MoneyPage';
import type { SendCapability } from '@/services/send/send-client';
import { SEND_COPY } from '@/config/send';
import { ROUTES } from '@/config/routes';

/**
 * Nothing on the send screen can work without a wallet to spend from, so say
 * so instead of rendering a form that ends in a refusal. "Connect a wallet" is
 * the right ask only when the wallet is the problem; when our key is missing,
 * sending them to set one up blames them for our outage.
 */
export function SendUnavailablePrompt({ capability }: { capability: SendCapability }) {
  const oursNotTheirs = capability.reason === 'sending_unavailable';
  return (
    <MoneyPrompt
      heading={oursNotTheirs ? SEND_COPY.unavailableTitle : SEND_COPY.noWalletTitle}
      body={
        capability.reason === 'no_sender_wallet'
          ? SEND_COPY.noWalletBody
          : (capability.message ?? SEND_COPY.noWalletBody)
      }
    >
      {!oursNotTheirs && (
        <Button variant="primary" className="w-full" href={ROUTES.DASHBOARD.WALLETS_FOR_SEND}>
          {SEND_COPY.noWalletCta}
        </Button>
      )}
    </MoneyPrompt>
  );
}
