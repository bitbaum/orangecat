'use client';

/** Get, or give back, a free ticket — then reload the page so the box shows the result. */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

interface ClaimTicketButtonProps {
  eventId: string;
  mode: 'claim' | 'cancel';
}

export default function ClaimTicketButton({ eventId, mode }: ClaimTicketButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/ticket`, {
        method: mode === 'claim' ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || 'Something went wrong — try again.');
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
      {mode === 'claim' ? (
        <Button variant="accent" className="w-full" onClick={run} isLoading={busy} disabled={busy}>
          Get a free ticket
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={run} disabled={busy}>
          Can&apos;t make it — give my place back
        </Button>
      )}
      {error && <p className="text-sm text-status-negative">{error}</p>}
    </div>
  );
}
