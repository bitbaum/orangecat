'use client';

import { useRef } from 'react';
import { Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import { STEAL_QR_FILENAME, STEAL_QR_TARGET } from '@/config/steal';

/**
 * The campaign QR code, plus a download of the same SVG so anyone can print
 * the poster. The download serializes what is on screen: one QR, never two
 * that could disagree about where they point.
 */
export function StealQrCode() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const download = () => {
    const svg = wrapperRef.current?.querySelector('svg');
    if (!svg) {
      return;
    }
    const markup = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = STEAL_QR_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={wrapperRef} className="rounded-xl bg-white p-4">
        <QRCodeSVG value={STEAL_QR_TARGET} size={200} marginSize={1} title="Steal the cat" />
      </div>
      <Button variant="outline" size="sm" onClick={download}>
        <Download className="h-4 w-4 mr-2" />
        Download the QR code
      </Button>
    </div>
  );
}
