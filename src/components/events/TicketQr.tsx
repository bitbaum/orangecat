'use client';

import { QRCodeSVG } from 'qrcode.react';
import { QR_RENDER } from '@/config/payment-qr';

/** A ticket's QR: the check-in link the organizer's camera opens. */
export default function TicketQr({ value }: { value: string }) {
  return (
    <div className="flex justify-center rounded-lg border border-default bg-surface-base p-4">
      <QRCodeSVG
        value={value}
        size={208}
        level={QR_RENDER.level}
        bgColor={QR_RENDER.bgColor}
        fgColor={QR_RENDER.fgColor}
        marginSize={2}
        aria-label="Ticket QR code"
      />
    </div>
  );
}
