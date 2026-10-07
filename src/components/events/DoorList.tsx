'use client';

/**
 * The guest list at the door: who is in, who is still to come, and a manual
 * check-in for a guest whose phone died (find them by name).
 */

import { useMemo, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatEventClock } from '@/domain/events/time';

export interface DoorGuest {
  code: string;
  name: string;
  count: number;
  paid: boolean;
  checkedInAt: string | null;
}

interface DoorListProps {
  eventId: string;
  guests: DoorGuest[];
  capacity: number | null;
  /** The event's zone: check-in times read on the venue's clock. */
  zone: string;
}

export default function DoorList({ eventId, guests, capacity, zone }: DoorListProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const people = guests.reduce((n, g) => n + g.count, 0);
  const inside = guests.reduce((n, g) => n + (g.checkedInAt ? g.count : 0), 0);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? guests.filter(g => g.name.toLowerCase().includes(q)) : guests;
    // Still to come first — that is who the door is looking for.
    return [...list].sort((a, b) => Number(!!a.checkedInAt) - Number(!!b.checkedInAt));
  }, [guests, query]);

  async function checkIn(code: string) {
    setBusy(code);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.EVENTS.CHECK_IN(eventId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        throw new Error('Could not check in — try again.');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-fg-primary">
        <span className="text-2xl font-semibold">{inside}</span> in · {people - inside} still to
        come · {people} {people === 1 ? 'ticket' : 'tickets'}
        {capacity ? ` of ${capacity}` : ''}
      </p>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Find a guest by name"
        aria-label="Find a guest by name"
        className="min-h-11 w-full rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
      />
      {error && <p className="text-sm text-status-negative">{error}</p>}
      {guests.length === 0 ? (
        <p className="text-sm text-fg-secondary">No tickets yet.</p>
      ) : (
        <ul className="divide-y divide-default rounded-xl border border-default">
          {shown.map(g => (
            <li key={g.code} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="break-words font-medium text-fg-primary">
                  {g.name}
                  {g.count > 1 ? ` · ${g.count}` : ''}
                </div>
                <div className="text-sm text-fg-secondary">
                  {g.paid ? 'Paid' : 'Free'}
                  {g.checkedInAt ? ` · in at ${formatEventClock(g.checkedInAt, zone)}` : ''}
                </div>
              </div>
              {g.checkedInAt ? (
                <Check className="h-5 w-5 shrink-0 text-status-positive" aria-label="Checked in" />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkIn(g.code)}
                  isLoading={busy === g.code}
                  disabled={busy !== null}
                >
                  Check in
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
