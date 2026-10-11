'use client';

import { useEffect, useState } from 'react';
import { Bitcoin, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PaymentQRCode } from './PaymentQRCode';
import { PaymentStatusIndicator } from './PaymentStatusIndicator';
import { AmountField } from '@/components/money/AmountField';
import { PUBLIC_API_BASE } from '@/config/public-api';
import { DEFAULT_CONTRIBUTION_BTC } from '@/config/payment-presets';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import type { EntityType } from '@/config/entity-registry';
import type { PaymentIntentStatus, PaymentMethod } from '@/domain/payments';

interface PublicSupportPanelProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
}

interface PublicIntent {
  payment_intent: {
    id: string;
    amount_btc: number;
    payment_method: PaymentMethod;
    status: PaymentIntentStatus;
    expires_at: string | null;
    can_acknowledge: boolean;
  };
  status_token: string;
  qr_data: string;
  method_label: string;
  expires_in_seconds: number | null;
}

type Phase =
  'choose' | 'creating' | 'awaiting' | 'recipient_confirmation' | 'paid' | 'expired' | 'error';

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message || 'Could not create the payment request.';
}

export function PublicSupportPanel({ entityType, entityId, entityTitle }: PublicSupportPanelProps) {
  const [amountBtc, setAmountBtc] = useState<number>(DEFAULT_CONTRIBUTION_BTC);
  const [phase, setPhase] = useState<Phase>('choose');
  const [intent, setIntent] = useState<PublicIntent | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!intent || (phase !== 'awaiting' && phase !== 'recipient_confirmation')) {
      return;
    }

    let stopped = false;
    const check = async () => {
      const response = await fetch(
        `${PUBLIC_API_BASE}/payments/public/${intent.payment_intent.id}`,
        {
          headers: { 'x-payment-token': intent.status_token },
          cache: 'no-store',
        }
      );
      if (!response.ok || stopped) {
        return;
      }
      const body = (await response.json()) as {
        data: {
          status: PaymentIntentStatus;
          requires_recipient_confirmation: boolean;
        };
      };
      if (body.data.status === 'paid') {
        setPhase('paid');
      } else if (body.data.status === 'expired') {
        setPhase('expired');
      } else if (body.data.status === 'failed') {
        // Not "expired": a failed payment is a different thing to be told.
        setError(
          'This payment didn’t go through. If your wallet shows it as sent, check its history before trying again.'
        );
        setPhase('error');
      } else if (body.data.requires_recipient_confirmation) {
        setPhase('recipient_confirmation');
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [intent, phase]);

  const createIntent = async () => {
    setPhase('creating');
    setError('');
    try {
      const response = await fetch(`${PUBLIC_API_BASE}/payments/public`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          amount_btc: amountBtc,
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const body = (await response.json()) as { data: PublicIntent };
      setIntent(body.data);
      setPhase('awaiting');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the payment request.');
      setPhase('error');
    }
  };

  const acknowledge = async () => {
    if (!intent) {
      return;
    }
    const response = await fetch(`${PUBLIC_API_BASE}/payments/public/${intent.payment_intent.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-payment-token': intent.status_token,
      },
      body: JSON.stringify({ action: 'acknowledge' }),
    });
    if (response.ok) {
      setPhase('recipient_confirmation');
    } else {
      setError(await readError(response));
      setPhase('error');
    }
  };

  const reset = () => {
    setIntent(null);
    setError('');
    setPhase('choose');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bitcoin className="h-5 w-5 text-bitcoinOrange" />
          Support with Bitcoin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'choose' && (
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

        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-7 w-7 animate-spin text-fg-tertiary" />
            <p className="text-sm text-fg-secondary">Creating payment request…</p>
          </div>
        )}

        {(phase === 'awaiting' || phase === 'recipient_confirmation') && intent && (
          <div className="space-y-4">
            <PaymentQRCode
              qrData={intent.qr_data}
              methodLabel={intent.method_label}
              amountBtc={intent.payment_intent.amount_btc}
              expiresInSeconds={intent.expires_in_seconds ?? undefined}
              size={192}
            />
            <PaymentStatusIndicator
              status={
                phase === 'recipient_confirmation'
                  ? 'buyer_confirmed'
                  : intent.payment_intent.status
              }
            />
            {phase === 'awaiting' && intent.payment_intent.can_acknowledge && (
              <Button variant="outline" onClick={acknowledge} className="w-full min-h-11">
                I&apos;ve paid
              </Button>
            )}
            {phase === 'recipient_confirmation' && (
              <p className="text-center text-sm text-fg-secondary">
                The recipient must confirm this Lightning Address payment before it appears in the
                public funding total.
              </p>
            )}
          </div>
        )}

        {phase === 'paid' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-status-positive" />
            <p className="font-semibold text-fg-primary">Support confirmed</p>
            <p className="text-sm text-fg-secondary">
              This contribution can now be included in the public Bitcoin funding record.
            </p>
          </div>
        )}

        {(phase === 'expired' || phase === 'error') && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-status-negative">
              {phase === 'expired' ? 'This payment request expired.' : error}
            </p>
            <Button variant="outline" onClick={reset} className="w-full min-h-11 gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
