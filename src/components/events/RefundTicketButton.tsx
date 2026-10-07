'use client';

/**
 * Refund one paid ticket, organizer only. Same two honest ways as paying the
 * crew: send what they paid back from the organizer's wallet, or record that
 * it was given back another way. Either way the ticket is cancelled and its
 * seat freed — so it asks once before doing it.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import type { EventPayoutMethod } from '@/config/event-payouts';

interface RefundTicketButtonProps {
  eventId: string;
  attendeeId: string;
  guestName: string;
}

export default function RefundTicketButton({
  eventId,
  attendeeId,
  guestName,
}: RefundTicketButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund(method: EventPayoutMethod) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.EVENTS.REFUNDS(eventId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendee_id: attendeeId, method }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || 'The refund did not go through.');
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Refund
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-default p-2">
      <p className="text-sm text-fg-secondary">
        Refund {guestName}? Their ticket is cancelled and the seat freed.
      </p>
      <Button
        variant="outline"
        size="sm"
        isLoading={busy}
        disabled={busy}
        onClick={() => refund('lightning')}
      >
        Send it back in Bitcoin from my wallet
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => refund('other')}>
        I gave it back another way (Twint, cash)
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
        Keep the ticket
      </Button>
      {error && <p className="text-sm text-status-negative">{error}</p>}
    </div>
  );
}
