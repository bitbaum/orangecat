'use client';

/** "Can't make it": a guest gives their free place back, by the ticket's own code. */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { guestTicketStorageKey } from './GuestTicketForm';

interface GuestTicketGiveBackProps {
  eventId: string;
  code: string;
}

export default function GuestTicketGiveBack({ eventId, code }: GuestTicketGiveBackProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function giveBack() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_ROUTES.EVENTS.TICKET(eventId)}?code=${encodeURIComponent(code)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || 'Something went wrong — try again.');
      }
      try {
        window.localStorage.removeItem(guestTicketStorageKey(eventId));
      } catch {
        // Nothing remembered to forget.
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-2">
      <Button variant="ghost" size="sm" onClick={giveBack} disabled={busy}>
        Can&apos;t make it — give my place back
      </Button>
      {error && <p className="text-sm text-status-negative">{error}</p>}
    </div>
  );
}
