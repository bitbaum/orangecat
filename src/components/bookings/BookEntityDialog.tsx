'use client';

/**
 * BookEntityDialog
 *
 * A booking request over a service or asset page, POSTed to /api/bookings as
 * a pending booking the provider confirms or rejects (/dashboard/bookings →
 * Incoming).
 *
 * It used to be two raw datetime-local fields — start AND end — for everyone,
 * showing the browser's placeholder ("tt.mm.jjjj, --:--"), including for a
 * studio rented by the day. Now the listing decides what is asked
 * (domain/bookings/shape) and @bitbaum/whenkit asks it in taps:
 *  - rented by the day/week/month → pick a day or a range, no times;
 *  - hourly → a day, a start inside opening hours, a length (or the
 *    service's fixed duration). Nobody types an end time;
 *  - "I'm flexible" → at most a preferred day; the provider proposes a time.
 *
 * Instants come from whenkit's resolveRequest in the listing's zone when it
 * states one, else the booker's — the same clock that is sent as `timezone`.
 * On success we toast + close; the user is browsing, not managing.
 */

import { useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { toast } from 'sonner';
import { Calendar, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import Button from '@/components/ui/Button';
import { BookingRequestPicker } from '@bitbaum/whenkit/react';
import { resolveRequest, todayIn, type BookingChoice } from '@bitbaum/whenkit';
import '@bitbaum/whenkit/styles.css';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { browserTimeZone } from '@/utils/timezone';
import { APP_LOCALE } from '@/utils/locale';
import type { BookingShape } from '@/domain/bookings/shape';

/** Leads the note of a flexible request, so the provider reads the window as a wish. */
export const FLEXIBLE_NOTE = 'Flexible — please suggest a time.';

export interface BookEntityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookableType: 'service' | 'asset';
  bookableId: string;
  bookableTitle: string;
  /** The listing's price. Display only — the server re-reads the bookable's current
   *  price authoritatively. For assets this is BTC; for services it's a value in
   *  `priceCurrency`. */
  priceBtc?: number;
  /** Currency `priceBtc` is denominated in. Omitted/'BTC' → render as BTC; otherwise
   *  render as that fiat currency (services price in their own currency, not BTC). */
  priceCurrency?: string;
  /** What to ask for — from serviceBookingShape / assetBookingShape. */
  shape: BookingShape;
}

export function BookEntityDialog({
  isOpen,
  onClose,
  bookableType,
  bookableId,
  bookableTitle,
  priceBtc,
  priceCurrency,
  shape,
}: BookEntityDialogProps) {
  const { formatPrice } = useDisplayCurrency();
  const [choice, setChoice] = useState<BookingChoice | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const zone = shape.zone ?? browserTimeZone();
  const request = resolveRequest(choice, { zone, today: todayIn(zone) });
  const fixedLength = shape.lengths?.length === 1 ? shape.lengths[0] : null;

  const reset = () => {
    setChoice(null);
    setNotes('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!request) {
      toast.error(shape.unit === 'day' ? 'Pick a day' : 'Pick a day and a start time');
      return;
    }
    const customerNotes = request.flexible
      ? [FLEXIBLE_NOTE, notes.trim()].filter(Boolean).join('\n\n')
      : notes.trim();

    setSubmitting(true);
    try {
      const res = await fetch(API_ROUTES.BOOKINGS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookable_type: bookableType,
          bookable_id: bookableId,
          starts_at: request.startsAt,
          ends_at: request.endsAt,
          // The clock the request was made on, so the provider sees
          // "14:00 Zurich time", not UTC.
          timezone: zone,
          customer_notes: customerNotes || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error?.message || `Failed to book (${res.status})`);
        return;
      }
      toast.success('Booking request sent — provider will confirm or reject.');
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-fg-primary" />
            Book {bookableTitle}
          </DialogTitle>
          <DialogDescription>
            Send a booking request to the provider. They&apos;ll confirm or reject.
            {typeof priceBtc === 'number' && priceBtc > 0 && (
              <span className="mt-1 block text-sm">
                Price:{' '}
                <span className="font-medium text-fg-primary">
                  {formatPrice(priceBtc, priceCurrency)}
                </span>
                {fixedLength && ` · ${fixedLength} min`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <BookingRequestPicker
            unit={shape.unit}
            zone={zone}
            locale={APP_LOCALE}
            hours={shape.hours}
            openWeekdays={shape.openWeekdays}
            lengths={shape.lengths}
            value={choice}
            onChange={setChoice}
          />

          <div>
            <label
              className="mb-1 block text-sm font-medium text-fg-primary"
              htmlFor="booking-notes"
            >
              Note to the provider (optional)
            </label>
            {/* 16px on phones: below it iOS zooms the page when the box is focused. */}
            <textarea
              id="booking-notes"
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, 1000))}
              disabled={submitting}
              rows={3}
              maxLength={1000}
              placeholder={
                choice?.kind === 'flexible'
                  ? 'When suits you — e.g. weekday evenings'
                  : 'Anything the provider should know'
              }
              className="w-full rounded-md border border-strong bg-surface-base px-3 py-2 text-base text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !request}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send booking request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
