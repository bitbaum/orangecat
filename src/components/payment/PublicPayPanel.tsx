/**
 * PublicPayPanel — let anyone pay an entity in Bitcoin without an account.
 *
 * Permissionless participation is a core principle: a logged-out visitor must
 * be able to send sats. The seller's receiving address is public data (the same
 * address the profile page already shows), so this reveals it with a QR, an
 * open-in-wallet link, and — for open-amount contributions — quick amount
 * suggestions. The payer settles directly from their own wallet — non-custodial,
 * no sign-up.
 *
 * Only renders for sellers with a static address (on-chain or Lightning
 * address). NWC-only sellers have no static address to reveal — the caller
 * falls back to the sign-in/invoice flow for those.
 */

'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { Bitcoin, Zap, Copy, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { PaymentExpectationNote } from './PaymentExpectationNote';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { displayBTC } from '@/services/currency';
import { LABELED_SUPPORT_AMOUNTS_BTC } from '@/config/payment-presets';

interface PublicPayPanelProps {
  entityTitle: string;
  /** Contribution entities accept any amount; fixed-price bake the amount in. */
  isContribution: boolean;
  /** Price in its own currency (fixed-price entities). */
  priceAmount?: number;
  /** Currency of priceAmount (e.g. 'CHF'); omitted/'BTC' → BTC. */
  priceCurrency?: string;
  /** BTC-converted amount for the BIP21 URI (0/undefined → payer chooses). */
  amountBtc?: number;
  /** Receiving method — drives icon, label, and URI scheme. */
  method: 'onchain' | 'lightning_address';
  /** The receiving address to reveal. */
  address: string;
  /**
   * Sign-in link for the optional "track your order" affordance (anonymous
   * visitors). Omit for already-authed contexts (e.g. a booking customer).
   */
  signInHref?: string;
}

function truncateMiddle(value: string, head = 12, tail = 10): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function PublicPayPanel({
  entityTitle,
  isContribution,
  priceAmount,
  priceCurrency,
  amountBtc,
  method,
  address,
  signInHref,
}: PublicPayPanelProps) {
  const { formatPrice, formatAmountBtc } = useDisplayCurrency();
  const { copied, copy } = useCopyToClipboard();

  const isOnchain = method === 'onchain';
  const Icon = isOnchain ? Bitcoin : Zap;
  const title = isOnchain ? 'Pay with Bitcoin' : 'Pay with Lightning';

  const hasFixedAmount = !isContribution && priceAmount !== undefined && priceAmount > 0;

  // Open-amount contributions: let the payer pick a quick amount. For on-chain
  // it bakes into the BIP21 URI (wallet pre-fills it); for a Lightning address
  // the URI can't carry an amount, so it's shown as guidance and the wallet
  // prompts for it.
  const [selectedBtc, setSelectedBtc] = useState<number | null>(null);
  const effectiveBtc = hasFixedAmount ? amountBtc : (selectedBtc ?? undefined);

  // Build the payment URI. On-chain uses BIP21 with the amount + label baked in;
  // a Lightning address is paid via the lightning: scheme (wallet prompts for
  // the amount, which we also surface on screen).
  const paymentUri = (() => {
    if (isOnchain) {
      const params = new URLSearchParams();
      if (effectiveBtc && effectiveBtc > 0) {
        params.set('amount', effectiveBtc.toFixed(8).replace(/\.?0+$/, ''));
      }
      if (entityTitle) {
        params.set('label', entityTitle);
      }
      const query = params.toString();
      return `bitcoin:${address}${query ? `?${query}` : ''}`;
    }
    return `lightning:${address}`;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-bitcoinOrange" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasFixedAmount ? (
          <div className="flex items-baseline justify-between">
            <span className="text-fg-secondary">Amount</span>
            <span className="text-lg font-bold text-fg-primary">
              {formatPrice(priceAmount as number, priceCurrency)}
              {amountBtc && amountBtc > 0 && priceCurrency && priceCurrency !== 'BTC' && (
                <span className="ml-2 text-sm font-normal text-fg-secondary">
                  ≈ {formatAmountBtc(amountBtc)}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-fg-secondary">
              Choose an amount, or send any in your wallet.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {LABELED_SUPPORT_AMOUNTS_BTC.map(({ btc, label }) => {
                const active = selectedBtc === btc;
                return (
                  <button
                    key={btc}
                    type="button"
                    onClick={() => setSelectedBtc(active ? null : btc)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-center transition-colors',
                      active
                        ? 'border-bitcoinOrange bg-bitcoinOrange/10 text-fg-primary'
                        : 'border-default bg-surface-raised/40 text-fg-secondary hover:bg-surface-raised/70'
                    )}
                  >
                    <span className="block text-sm font-semibold text-fg-primary">
                      {formatAmountBtc(btc)}
                    </span>
                    <span className="block text-xs">{label}</span>
                  </button>
                );
              })}
            </div>
            {selectedBtc !== null && !isOnchain && (
              <p className="text-xs text-fg-tertiary">
                Lightning wallets ask for the amount — enter{' '}
                {`${formatAmountBtc(selectedBtc)} (${displayBTC(selectedBtc)})`} when prompted.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center rounded-lg border border-default bg-surface-base p-4">
          <QRCodeSVG value={paymentUri} size={192} level="M" />
        </div>

        <div className="space-y-1">
          <span className="text-xs text-fg-secondary">
            {isOnchain ? 'On-chain Bitcoin address' : 'Lightning address'}
          </span>
          <button
            type="button"
            onClick={() => copy(address)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-default bg-surface-raised/40 px-3 py-2 text-left hover:bg-surface-raised/70"
            aria-label="Copy receiving address"
          >
            <span className="min-w-0 truncate font-mono text-sm text-fg-primary">
              {truncateMiddle(address)}
            </span>
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-status-positive" />
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-fg-secondary" />
            )}
          </button>
        </div>

        <a
          href={paymentUri}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-bitcoinOrange px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-bitcoinOrange/90 min-h-11"
        >
          <ExternalLink className="h-4 w-4" />
          Open in wallet
        </a>

        <p className="text-xs text-fg-secondary text-center">
          Scan the QR or tap Open in wallet — pay from any {isOnchain ? 'Bitcoin' : 'Lightning'}{' '}
          wallet, no account needed.
        </p>
        <PaymentExpectationNote />
        {signInHref && (
          <p className="text-xs text-fg-tertiary text-center">
            Have an account?{' '}
            <Link href={signInHref} className="underline hover:text-fg-secondary">
              Sign in to track your order
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
