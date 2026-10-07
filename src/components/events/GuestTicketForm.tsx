'use client';

/**
 * A free ticket for someone without an account: their name, nothing else.
 *
 * The response names the ticket page, which IS the ticket (its link is the
 * guest's key), so the form goes straight there. The link is also remembered
 * on this device, so coming back to the event page offers it again instead of
 * a second ticket.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { GUEST_NAME_MAX } from '@/domain/events/tickets';

export const guestTicketStorageKey = (eventId: string) => `oc:guest-ticket:${eventId}`;

interface GuestTicketFormProps {
  eventId: string;
  eventPath: string;
}

export default function GuestTicketForm({ eventId, eventPath }: GuestTicketFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTicket, setSavedTicket] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSavedTicket(window.localStorage.getItem(guestTicketStorageKey(eventId)));
    } catch {
      // Storage blocked (private window): the ticket link itself is the way back.
    }
  }, [eventId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.EVENTS.TICKET(eventId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      const ticketPath = json?.data?.ticketPath as string | undefined;
      if (!res.ok || !ticketPath) {
        throw new Error(json?.error?.message || 'Something went wrong — try again.');
      }
      try {
        window.localStorage.setItem(guestTicketStorageKey(eventId), ticketPath);
      } catch {
        // Not remembered on this device; the page we open is still the ticket.
      }
      router.push(ticketPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {savedTicket && (
        <Link
          href={savedTicket}
          className="flex min-h-11 items-center justify-center rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
        >
          Open your ticket
        </Link>
      )}
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="Your name"
          name="name"
          autoComplete="name"
          required
          maxLength={GUEST_NAME_MAX}
          value={name}
          onChange={e => setName(e.target.value)}
          description="So the host knows who's coming. No account needed."
          error={error ?? undefined}
        />
        <Button
          type="submit"
          variant="accent"
          className="w-full"
          isLoading={busy}
          disabled={busy || !name.trim()}
        >
          {savedTicket ? 'Get another ticket' : 'Get a free ticket'}
        </Button>
      </form>
      <p className="text-center text-sm text-fg-secondary">
        Have an account?{' '}
        <Link
          href={`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(eventPath)}`}
          className="underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
