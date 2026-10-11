'use client';

import { useState } from 'react';
import { Bitcoin, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AmountField } from '@/components/money/AmountField';
import { PUBLIC_API_BASE } from '@/config/public-api';
import { DEFAULT_CONTRIBUTION_BTC } from '@/config/payment-presets';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { usePublicPayment } from '@/hooks/usePublicPayment';
import { PublicPaymentProgress } from './PublicPaymentProgress';
import type { EntityType } from '@/config/entity-registry';

interface PublicSupportPanelProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
}

export function PublicSupportPanel({ entityType, entityId, entityTitle }: PublicSupportPanelProps) {
  const [amountBtc, setAmountBtc] = useState<number>(DEFAULT_CONTRIBUTION_BTC);
  const payment = usePublicPayment();

  const createIntent = () =>
    payment.start(() =>
      fetch(`${PUBLIC_API_BASE}/payments/public`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          amount_btc: amountBtc,
        }),
      })
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bitcoin className="h-5 w-5 text-bitcoinOrange" />
          Support with Bitcoin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.phase === 'choose' && (
          <>
            <p className="text-sm text-fg-secondary">
              You will pay {entityTitle} directly; no account is required.
            </p>
            <AmountField
              value={amountBtc}
              onChange={setAmountBtc}
              minBtc={PAY_MIN_BTC}
              maxBtc={PAY_MAX_BTC}
              label="How much"
            />
            <Button
              onClick={createIntent}
              disabled={
                !Number.isFinite(amountBtc) || amountBtc < PAY_MIN_BTC || amountBtc > PAY_MAX_BTC
              }
              className="w-full min-h-11"
            >
              Create Bitcoin request
            </Button>
            <p className="text-center text-xs text-fg-tertiary">
              OrangeCat never holds the money. It goes straight to {entityTitle}&apos;s wallet.
            </p>
          </>
        )}

        <PublicPaymentProgress
          payment={payment}
          confirmationNote="The recipient must confirm this Lightning Address payment before it appears in the public funding total."
        />

        {payment.phase === 'paid' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-status-positive" />
            <p className="font-semibold text-fg-primary">Support confirmed</p>
            <p className="text-sm text-fg-secondary">
              This contribution can now be included in the public Bitcoin funding record.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
