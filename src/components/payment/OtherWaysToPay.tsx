'use client';

/**
 * The payer's side of "ways to be paid": every app the recipient listed,
 * one row each, one action each.
 *
 * A service with a pay link opens it, with the amount filled in when that
 * service takes the payer's currency. One without a link (Twint, a bank) is a
 * handle to copy into the app. These settle outside OrangeCat and the note
 * under the list says so — the page never claims to have seen them land.
 */

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import {
  PAYMENT_METHODS,
  PAYMENT_METHODS_COPY,
  paymentMethodUrl,
  type PayAmount,
} from '@/config/payment-methods';
import { formatPaymentHandle } from '@/lib/payments/payment-handle';
import type { PublicPaymentMethod } from '@/domain/payments/paymentMethodsService';

interface OtherWaysToPayProps {
  recipientName: string;
  methods: PublicPaymentMethod[];
  /** The amount the payer typed, in BTC (the canonical unit); 0 when none. */
  amountBtc: number;
  /** True when a Bitcoin way sits above this list, so the heading says "other". */
  afterBitcoin: boolean;
}

export function OtherWaysToPay({
  recipientName,
  methods,
  amountBtc,
  afterBitcoin,
}: OtherWaysToPayProps) {
  const { copied, copy } = useCopyToClipboard();
  const currency = useUserCurrency();
  const { convertFromBTC } = useCurrencyConversion();
  // Which row was copied last; `copied` from the hook says whether it still shows.
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);
  const copiedId = copied ? lastCopiedId : null;

  if (methods.length === 0) {
    return null;
  }

  // The payer thinks in their own currency; a link gets that number, not BTC.
  const amount: PayAmount | undefined =
    amountBtc > 0 && currency !== 'BTC'
      ? { value: convertFromBTC(amountBtc, currency), currency }
      : undefined;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-caps text-fg-tertiary">
        {afterBitcoin
          ? PAYMENT_METHODS_COPY.publicHeading(recipientName)
          : PAYMENT_METHODS_COPY.publicOnlyHeading(recipientName)}
      </h2>
      <ul className="divide-y divide-subtle rounded-lg border border-subtle bg-surface-base">
        {methods.map(row => {
          const kind = PAYMENT_METHODS[row.method];
          const url = paymentMethodUrl(row.method, row.handle, amount);
          const shown = formatPaymentHandle(row.method, row.handle);
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-fg-primary">
                  {kind.name}
                  {row.label && <span className="text-fg-secondary"> · {row.label}</span>}
                </p>
                <p className="truncate font-mono text-sm text-fg-secondary">{shown}</p>
              </div>
              {url ? (
                <Button variant="outline" size="sm" href={url} target="_blank" className="shrink-0">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {PAYMENT_METHODS_COPY.open}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setLastCopiedId(row.id);
                    void copy(shown);
                  }}
                >
                  {copiedId === row.id ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copiedId === row.id ? PAYMENT_METHODS_COPY.copied : PAYMENT_METHODS_COPY.copy}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-center text-xs text-fg-tertiary">
        {PAYMENT_METHODS_COPY.publicNote(recipientName)}
      </p>
    </section>
  );
}
