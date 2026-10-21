'use client';

/**
 * PaymentQRCode — an invoice, in the order a phone needs it.
 *
 * The person looking at this is usually holding the phone the invoice is on,
 * and a phone cannot scan its own screen (owner, 2026-10-21). So on a phone
 * the actions come first: Open in wallet hands the invoice to the wallet app,
 * Copy invoice for a wallet that has no link handler, and the code itself
 * sits behind "Show the code" for the case of a second device. From `sm` up —
 * a laptop with a phone beside it — the code is the point and is shown first.
 *
 * One line says what this is and how long it lasts; there is no bare
 * "Lightning" label and no second status line.
 */

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { QR_RENDER } from '@/config/payment-qr';
import { formatCountdownClock } from '@/utils/countdown';
import { cn } from '@/lib/utils';

interface PaymentQRCodeProps {
  /** QR data string (bolt11 uppercased or bitcoin: URI) */
  qrData: string;
  /** Human-readable payment method label */
  methodLabel: string;
  /** Amount in BTC */
  amountBtc: number;
  /** Size of the QR code in pixels */
  size?: number;
  /** Seconds until this invoice expires */
  expiresInSeconds?: number;
}

const COPY = {
  openInWallet: 'Open in wallet',
  copyInvoice: 'Copy invoice',
  copied: 'Copied',
  showCode: 'Show the code to scan',
  hideCode: 'Hide the code',
  expiresIn: (clock: string) => `expires in ${clock}`,
  expired: 'expired',
  noDeadline: 'no deadline',
} as const;

export function PaymentQRCode({
  qrData,
  methodLabel,
  amountBtc,
  size = QR_RENDER.defaultSize,
  expiresInSeconds,
}: PaymentQRCodeProps) {
  const { copied, copy } = useCopyToClipboard();
  const { formatAmountBtc } = useDisplayCurrency();
  const [secondsLeft, setSecondsLeft] = useState(expiresInSeconds ?? 0);
  const [codeShown, setCodeShown] = useState(false);

  useEffect(() => {
    if (!expiresInSeconds || expiresInSeconds <= 0) {
      return;
    }
    setSecondsLeft(expiresInSeconds);
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresInSeconds]);

  const isLightning = /^ln/i.test(qrData);
  const copyText = isLightning ? qrData.toLowerCase() : qrData;
  const walletLink = isLightning ? `lightning:${copyText}` : qrData;

  const hasDeadline = expiresInSeconds !== undefined && expiresInSeconds > 0;
  const deadline = !hasDeadline
    ? COPY.noDeadline
    : secondsLeft <= 0
      ? COPY.expired
      : COPY.expiresIn(formatCountdownClock(secondsLeft));
  const urgent = hasDeadline && secondsLeft < 60;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-heading text-3xl font-semibold tracking-display text-fg-primary">
          {formatAmountBtc(amountBtc)}
        </p>
        <p className={cn('mt-1 text-sm', urgent ? 'text-status-negative' : 'text-fg-secondary')}>
          {methodLabel} · {deadline}
        </p>
      </div>

      <div className="grid gap-2">
        <Button variant="primary" href={walletLink} className="w-full">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {COPY.openInWallet}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => void copy(copyText)}>
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? COPY.copied : COPY.copyInvoice}
        </Button>
      </div>

      {/* The code: first on a wide screen, a tap away on a phone. */}
      <div className={cn('justify-center', codeShown ? 'flex' : 'hidden sm:flex')}>
        <div className="overflow-hidden rounded-md border border-subtle">
          <QRCodeSVG
            value={qrData}
            size={size}
            level={QR_RENDER.level}
            includeMargin
            bgColor={QR_RENDER.bgColor}
            fgColor={QR_RENDER.fgColor}
            title={`${methodLabel} code for ${formatAmountBtc(amountBtc)}`}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCodeShown(v => !v)}
        aria-expanded={codeShown}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary sm:hidden"
      >
        <QrCode className="h-4 w-4" aria-hidden="true" />
        {codeShown ? COPY.hideCode : COPY.showCode}
      </button>
    </div>
  );
}
