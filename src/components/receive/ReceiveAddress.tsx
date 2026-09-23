'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Share2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RECEIVE_COPY } from '@/config/receive';
import { QR_RENDER } from '@/config/payment-qr';

interface ReceiveAddressProps {
  address: string;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}

/** The in-person code for any amount. Only rendered when that code can actually be paid. */
export function ReceiveAddress({ address, copied, onCopy, onShare }: ReceiveAddressProps) {
  return (
    <section className="flex flex-col items-center gap-4">
      <h2 className="self-start text-sm font-semibold text-fg-primary">
        {RECEIVE_COPY.addressLabel}
      </h2>
      <div className="w-full max-w-64 rounded-lg bg-surface-base p-4 shadow-sm">
        <QRCodeSVG
          value={`lightning:${address}`}
          size={QR_RENDER.defaultSize}
          level={QR_RENDER.level}
          includeMargin
          bgColor={QR_RENDER.bgColor}
          fgColor={QR_RENDER.fgColor}
          className="h-auto w-full"
        />
      </div>
      <p className="flex max-w-full items-center gap-2 break-all text-center font-mono text-sm text-fg-primary">
        <Zap className="h-4 w-4 shrink-0 text-bitcoinOrange" aria-hidden="true" />
        {address}
      </p>
      <p className="text-center text-xs text-fg-tertiary">{RECEIVE_COPY.addressHint}</p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" onClick={onCopy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? RECEIVE_COPY.copied : RECEIVE_COPY.copy}
        </Button>
        <Button variant="accent" className="w-full sm:w-auto" onClick={onShare}>
          <Share2 className="mr-2 h-4 w-4" />
          {RECEIVE_COPY.share}
        </Button>
      </div>
    </section>
  );
}
