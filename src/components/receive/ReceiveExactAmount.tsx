'use client';

import { Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AmountField } from '@/components/money/AmountField';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { PaymentQRCode } from '@/components/payment/PaymentQRCode';
import { RECEIVE_COPY, RECEIVE_MAX_BTC, RECEIVE_MIN_BTC } from '@/config/receive';
import type { ReceiveRequest, ReceiveWalletOption } from '@/services/receive/receive-client';

type SettleState = 'pending' | 'paid' | 'expired';

interface ReceiveExactAmountProps {
  amount: number;
  onAmount: (value: number) => void;
  wallets: ReceiveWalletOption[];
  walletId: string | undefined;
  onWallet: (id: string | undefined) => void;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  request: ReceiveRequest | null;
  settleState: SettleState;
  onReset: () => void;
}

/**
 * A code for one amount, for someone who is here.
 * Asking a named OrangeCat account is the Request page, not this.
 */
export function ReceiveExactAmount({
  amount,
  onAmount,
  wallets,
  walletId,
  onWallet,
  generating,
  error,
  onGenerate,
  request,
  settleState,
  onReset,
}: ReceiveExactAmountProps) {
  return (
    <section className="space-y-4 border-t border-subtle pt-6">
      <div>
        <h2 className="text-sm font-semibold text-fg-primary">{RECEIVE_COPY.exactHeading}</h2>
        <p className="mt-1 text-xs text-fg-tertiary">{RECEIVE_COPY.exactHint}</p>
      </div>

      {request && settleState === 'paid' ? (
        <MoneyReceipt
          title={RECEIVE_COPY.paidTitle}
          amountBtc={request.amountBtc}
          counterpartyLabel="Via"
          counterparty={request.methodLabel}
          fallbackBody={RECEIVE_COPY.paidBody}
        >
          <Button variant="accent" onClick={onReset}>
            {RECEIVE_COPY.again}
          </Button>
        </MoneyReceipt>
      ) : request && settleState === 'expired' ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <Clock className="h-12 w-12 text-fg-tertiary" aria-hidden="true" />
          <p className="text-lg font-semibold text-fg-primary">{RECEIVE_COPY.expiredTitle}</p>
          <p className="text-sm text-fg-secondary">{RECEIVE_COPY.expiredBody}</p>
          <Button variant="outline" className="mt-2" onClick={onReset}>
            {RECEIVE_COPY.again}
          </Button>
        </div>
      ) : request ? (
        <div className="space-y-4">
          <PaymentQRCode
            qrData={request.qrData}
            methodLabel={request.methodLabel}
            amountBtc={request.amountBtc}
            expiresInSeconds={request.expiresInSeconds ?? undefined}
          />
          <p className="flex items-center justify-center gap-2 text-center text-sm text-fg-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {RECEIVE_COPY.scan}
          </p>
          {request.paymentMethod === 'onchain' && (
            <p className="text-center text-xs text-fg-tertiary">{RECEIVE_COPY.onchainNote}</p>
          )}
          <div className="flex justify-center">
            <Button variant="outline" onClick={onReset}>
              {RECEIVE_COPY.again}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <AmountField
            value={amount}
            onChange={onAmount}
            minBtc={RECEIVE_MIN_BTC}
            maxBtc={RECEIVE_MAX_BTC}
          />
          {wallets.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-fg-secondary">
                {RECEIVE_COPY.walletLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {[{ id: undefined, label: RECEIVE_COPY.primaryWallet }, ...wallets].map(wallet => (
                  <button
                    key={wallet.id ?? 'primary'}
                    type="button"
                    aria-pressed={walletId === wallet.id}
                    onClick={() => onWallet(wallet.id)}
                    className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                      walletId === wallet.id
                        ? 'border-accent-primary bg-accent-primary/10 text-fg-primary'
                        : 'border-default text-fg-secondary hover:text-fg-primary'
                    }`}
                  >
                    {wallet.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-status-negative">{error}</p>}
          <p className="text-center text-xs text-fg-tertiary">{RECEIVE_COPY.requestHint}</p>
          <Button
            variant="accent"
            className="w-full"
            onClick={onGenerate}
            disabled={generating || amount <= 0}
            isLoading={generating}
          >
            {generating ? RECEIVE_COPY.generating : RECEIVE_COPY.generate}
          </Button>
        </>
      )}
    </section>
  );
}
