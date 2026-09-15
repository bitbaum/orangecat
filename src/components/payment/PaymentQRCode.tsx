/**
 * PaymentQRCode — Displays QR code with copy-to-clipboard
 *
 * Shows a QR code for Lightning bolt11 or on-chain BIP21 URI,
 * with a "Copy" button, "Open in wallet" deep link, countdown timer,
 * and fiat equivalent display.
 */

'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { QR_RENDER } from '@/config/payment-qr';
import { formatCountdownClock } from '@/utils/countdown';

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

export function PaymentQRCode({
  qrData,
  methodLabel,
  amountBtc,
  size = 256,
  expiresInSeconds,
}: PaymentQRCodeProps) {
  const { copied, copy } = useCopyToClipboard();
  const [secondsLeft, setSecondsLeft] = useState(expiresInSeconds ?? 0);
  const { formatAmountBtc } = useDisplayCurrency();

  // Live countdown timer
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

  const isLightning = qrData.startsWith('LN') || qrData.startsWith('ln');
  const isOnchain = qrData.startsWith('bitcoin:');
  const copyText = isLightning ? qrData.toLowerCase() : qrData;

  const handleCopy = () => void copy(copyText);

  // Deep link to open in a Lightning wallet
  const walletLink = isLightning ? `lightning:${qrData.toLowerCase()}` : qrData;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-fg-secondary">{methodLabel}</p>

      <div className="rounded-lg bg-surface-base p-4 shadow-sm">
        <QRCodeSVG
          value={qrData}
          size={size}
          level={QR_RENDER.level}
          includeMargin
          bgColor={QR_RENDER.bgColor}
          fgColor={QR_RENDER.fgColor}
        />
      </div>

      {/* Amount display */}
      <div className="text-center">
        <p className="text-lg font-semibold">{formatAmountBtc(amountBtc)}</p>
      </div>

      {/* Countdown timer */}
      {expiresInSeconds !== undefined && expiresInSeconds > 0 && (
        <p
          className={`flex items-center gap-1 text-xs ${
            secondsLeft <= 0
              ? 'text-status-negative font-medium'
              : secondsLeft < 60
                ? 'text-status-negative'
                : 'text-fg-tertiary'
          }`}
        >
          <Timer className="h-3 w-3" />
          {secondsLeft <= 0 ? 'Invoice expired' : `Expires in ${formatCountdownClock(secondsLeft)}`}
        </p>
      )}

      {/* No countdown on-chain, because there is no deadline to count down to.
          Say so, rather than leaving the payer to wonder whether the QR went
          stale — a Bitcoin address keeps accepting payment indefinitely. */}
      {expiresInSeconds === undefined && isOnchain && (
        <p className="flex items-center gap-1 text-xs text-fg-tertiary">
          <Timer className="h-3 w-3" />
          No deadline — this address stays valid
        </p>
      )}

      {/* Action buttons — wallet link first on mobile (can't scan own screen) */}
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Button variant="primary" size="sm" href={walletLink} className="min-h-11 sm:order-2">
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Wallet
        </Button>

        <Button variant="outline" size="sm" onClick={handleCopy} className="min-h-11 sm:order-1">
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Invoice
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
