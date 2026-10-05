/**
 * On an organization's page: where its door is, and what is on there next.
 * Renders nothing for a group with neither — most groups are not venues.
 * Async server component; the events list is whatever events RLS shows.
 */

import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarDays, MapPin } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import { formatCurrency } from '@/services/currency';
import {
  getVenueGroup,
  listUpcomingAtVenue,
  venueAddressLine,
  type VenueEvent,
} from '@/domain/events/venue-page';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

export default async function VenueEventsSection({ groupId }: { groupId: string }) {
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  const [venue, events] = await Promise.all([
    getVenueGroup(supabase, groupId).catch(() => null),
    listUpcomingAtVenue(supabase, groupId).catch((error: unknown): VenueEvent[] => {
      logger.warn('Could not list venue events', { groupId, error: String(error) }, 'Venues');
      return [];
    }),
  ]);
  const address = venue ? venueAddressLine(venue) : null;
  if (!venue || (!address && events.length === 0)) {
    return null;
  }
  const hasPin = venue.latitude !== null && venue.longitude !== null;

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 pb-10 sm:px-6">
      {address && (
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-fg-primary" />
          <div className="min-w-0">
            <div className="break-words text-fg-primary">{address}</div>
            {hasPin && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${venue.latitude}&mlon=${venue.longitude}#map=18/${venue.latitude}/${venue.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-4"
              >
                Open in map
              </a>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-fg-primary">
          <CalendarDays className="h-5 w-5" />
          What&apos;s on at {venue.name}
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-fg-secondary">Nothing announced yet.</p>
        ) : (
          <ul className="divide-y divide-default rounded-xl border border-default">
            {events.map(ev => (
              <li key={ev.id}>
                <Link
                  href={ROUTES.EVENTS.VIEW(ev.id)}
                  className="flex flex-col gap-1 p-4 transition-colors hover:bg-surface-raised"
                >
                  <span className="break-words font-medium text-fg-primary">{ev.title}</span>
                  <span className="text-sm text-fg-secondary">
                    {format(new Date(ev.start_date), 'EEE d MMM, HH:mm')}
                    {' · '}
                    {ev.is_free || !ev.ticket_price
                      ? 'Free'
                      : formatCurrency(Number(ev.ticket_price), ev.currency || 'CHF')}
                    {ev.status === 'full' ? ' · Sold out' : ''}
                    {ev.music_genres?.length ? ` · ${ev.music_genres.join(', ')}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
