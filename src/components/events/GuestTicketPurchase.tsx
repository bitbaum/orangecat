'use client';

/**
 * A paid ticket for someone without an account: their name, then Bitcoin.
 *
 * The invoice goes to the organizer's own wallet. Once it settles, the status
 * poll names the ticket page — which IS the ticket, as for a free guest
 * ticket — and the guest is sent there. An unpaid request is kept on this
 * device, so closing the tab mid-payment comes back to the same QR.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bitcoin, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PublicPaymentProgress } from '@/components/payment/PublicPaymentProgress';
import { usePublicPayment } from '@/hooks/usePublicPayment';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { GUEST_NAME_MAX } from '@/domain/events/tickets';
import { guestTicketStorageKey } from './GuestTicketForm';

const pendingPaymentKey = (eventId: string) => `oc:guest-ticket-payment:${eventId}`;

interface GuestTicketPurchaseProps {
  eventId: string;
  eventPath: string;
}

export default function GuestTicketPurchase({ eventId, eventPath }: GuestTicketPurchaseProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [savedTicket, setSavedTicket] = useState<string | null>(null);
  const [ticketMissing, setTicketMissing] = useState(false);

  const onPaid = useCallback(
    ({ guest_ticket_path: ticketPath }: { guest_ticket_path?: string }) => {
      if (!ticketPath) {
        setTicketMissing(true);
        return;
      }
      try {
        window.localStorage.setItem(guestTicketStorageKey(eventId), ticketPath);
      } catch {
        // Not remembered here; the page we open is still the ticket.
      }
      router.push(ticketPath);
    },
    [eventId, router]
  );
  const payment = usePublicPayment({ resumeKey: pendingPaymentKey(eventId), onPaid });

  useEffect(() => {
    try {
      setSavedTicket(window.localStorage.getItem(guestTicketStorageKey(eventId)));
    } catch {
      // Storage blocked (private window): the ticket link itself is the way back.
    }
  }, [eventId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void payment.start(() =>
      fetch(API_ROUTES.EVENTS.TICKET_PURCHASE(eventId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bitcoin className="h-5 w-5 text-bitcoinOrange" />
          Buy a ticket with Bitcoin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.phase === 'choose' && (
          <>
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
                description="The name on the door list. No account needed."
              />
              <Button type="submit" variant="accent" className="w-full" disabled={!name.trim()}>
                {savedTicket ? 'Buy another ticket' : 'Pay for a ticket'}
              </Button>
            </form>
            <p className="text-center text-xs text-fg-tertiary">
              The money goes straight to the organizer&apos;s wallet. Your ticket opens here as soon
              as it lands.
            </p>
            <p className="text-center text-sm text-fg-secondary">
              Have an account?{' '}
              <Link
                href={`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(eventPath)}`}
                className="underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </>
        )}

        <PublicPaymentProgress
          payment={payment}
          confirmationNote="The organizer confirms this Lightning Address payment by hand. Keep this page: your ticket opens here when they do."
        />

        {payment.phase === 'paid' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-status-positive" />
            {ticketMissing ? (
              <>
                <p className="font-semibold text-fg-primary">Paid</p>
                <p className="text-sm text-fg-secondary">
                  Your ticket did not open. The organizer has your payment and your name; tell them
                  at the door.
                </p>
              </>
            ) : (
              <p className="font-semibold text-fg-primary">Paid. Opening your ticket…</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
