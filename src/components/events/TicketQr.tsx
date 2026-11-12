'use client';

import { ScanCode } from '@/components/ui/ScanCode';

/** A ticket's QR: the check-in link the organizer's camera opens. */
export default function TicketQr({ value }: { value: string }) {
  return (
    <div className="flex justify-center rounded-lg border border-default bg-surface-base p-4">
      <ScanCode value={value} size={208} aria-label="Ticket QR code" />
    </div>
  );
}
