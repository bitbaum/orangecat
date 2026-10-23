'use client';

/**
 * The payer's side of "ways to be paid": every rail the recipient listed,
 * one row each, one action each.
 *
 * A rail with a pay link opens it, with the amount filled in when that
 * service takes the payer's currency. One without a link (Twint, a bank) is a
 * handle to copy into the app. One shared on request has no handle here at
 * all — the server never sent it — and its action is Ask, which opens a
 * message to the recipient. These settle outside OrangeCat and the note under
 * the list says so; the page never claims to have seen them land.
 */

import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageSquare } from 'lucide-react';
import { RailGlyph } from '@/components/payment/RailGlyph';
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
import { ROUTES } from '@/config/routes';
import { formatPaymentHandle } from '@/lib/payments/payment-handle';
import type { PublicPaymentMethod } from '@/domain/payments/paymentMethodsService';

interface OtherWaysToPayProps {
  recipientName: string;
  /** Where an Ask lands: the recipient's profile id. */
  recipientId: string;
  methods: PublicPaymentMethod[];
  /** The amount the payer typed, in BTC (the canonical unit); 0 when none. */
  amountBtc: number;
  /** True when a Bitcoin way sits above this list, so the heading says "other". */
  afterBitcoin: boolean;
}

const ACTION = 'shrink-0';

export function OtherWaysToPay({
  recipientName,
  recipientId,
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
          const shown = row.handle ? formatPaymentHandle(row.method, row.handle) : null;
          const url = row.handle
            ? paymentMethodUrl(row.method, row.handle, amount, recipientName)
            : '';
          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-4">
              <RailGlyph kind={kind.handleKind} className="self-start" />
              <div className="min-w-0 flex-1">
                <p className="mb-0 font-medium text-fg-primary">
                  {kind.name}
                  {row.label && <span className="text-fg-secondary"> · {row.label}</span>}
                </p>
                {shown ? (
                  <p className="mb-0 truncate font-mono text-sm text-fg-secondary">{shown}</p>
                ) : (
                  <p className="mb-0 text-sm text-fg-secondary">
                    {PAYMENT_METHODS_COPY.sharedOnRequest(recipientName)}
                  </p>
                )}
              </div>
              {!row.handle ? (
                <Button
                  variant="outline"
                  size="sm"
                  href={ROUTES.MESSAGES_TO(recipientId)}
                  className={ACTION}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  {PAYMENT_METHODS_COPY.ask}
                </Button>
              ) : url ? (
                <Button variant="outline" size="sm" href={url} target="_blank" className={ACTION}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {PAYMENT_METHODS_COPY.open}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className={ACTION}
                  onClick={() => {
                    setLastCopiedId(row.id);
                    void copy(shown ?? '');
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
      <p className="mb-0 mt-2 text-center text-xs text-fg-tertiary">
        {PAYMENT_METHODS_COPY.publicNote(recipientName)}
      </p>
    </section>
  );
}
