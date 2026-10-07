import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';
import { eventZone, formatEventDate } from '@/domain/events/time';
import { eventPlaceText } from '@/domain/events/place';
import { Users, Clock, Repeat, Film, Music, Sparkles } from 'lucide-react';
import { safeHref } from '@/lib/security/safeHref';
import { formatRecurrence } from '@/lib/recurrence';
import EventCrewCard from '@/components/events/EventCrewCard';
import EventTicketCard from '@/components/events/EventTicketCard';
import EventVenueCard from '@/components/events/EventVenueCard';
import EventEssentials from '@/components/events/EventEssentials';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';

/** One line naming the place — shared with the calendar entry and the ticket. */
export const eventPlaceLine = eventPlaceText;

/** The selected columns the page metadata reads — SSOT for both callers. */
export const EVENT_METADATA_SELECT =
  'title, description, start_date, timezone, venue_name, venue_address, venue_city, music_genres';

const hasMapPin = (entity: Record<string, unknown>): boolean =>
  Number.isFinite(Number(entity.latitude ?? NaN)) &&
  Number.isFinite(Number(entity.longitude ?? NaN));

const genresOf = (entity: Record<string, unknown>): string[] =>
  Array.isArray(entity.music_genres)
    ? (entity.music_genres as unknown[]).filter((g): g is string => typeof g === 'string')
    : [];

const ticketOf = (entity: Record<string, unknown>) => {
  const amount = Number(entity.ticket_price ?? NaN);
  return !entity.is_free && Number.isFinite(amount) && amount > 0
    ? { amount, currency: (entity.currency as string) || 'CHF' }
    : null;
};

/** SSOT for the event detail page — shared by the public + owner dashboard routes. */
export const eventDetailConfig: EntityDetailConfig = {
  entityType: 'event',
  ownerLabel: 'Organizer',
  descriptionTitle: 'About this Event',
  backText: 'Back to Events',
  backHref: '/events',
  // Events are public in several statuses and never 'active' — the default
  // filter made every published event a 404 for everyone but its organizer.
  visibilityFilter: { column: 'status', value: EVENT_PUBLIC_STATUSES },
  metadataSelect: EVENT_METADATA_SELECT,
  getPrice: ticketOf,
  // A free event has nothing to pay: the section only told its guests "Sign
  // in to buy a ticket" or "hasn't connected a wallet yet".
  paymentSectionFor: entity => ticketOf(entity) !== null,
  // "Published" is the organizer's word. A visitor needs to hear only what
  // changes their plans.
  statusBadge: (entity, isOwner) =>
    isOwner ? (entity.status as string) : (VISITOR_STATUS[entity.status as string] ?? null),
  // A free ticket is in the first screen already (renderLead); a paid one is
  // bought in the pay panel, which on a phone sits at the very bottom.
  mobileStickyCTA: entity =>
    ticketOf(entity) && entity.status !== 'full' ? { href: '#pay', label: 'Buy a ticket' } : null,
  renderLead: (entity, isOwner) => (
    <>
      <EventEssentials event={entity} />
      <div id="ticket" className="scroll-mt-24">
        <EventTicketCard event={entity} isOwner={isOwner} />
      </div>
    </>
  ),
  renderSidebarExtra: entity =>
    typeof entity.asset_id === 'string' && entity.asset_id ? (
      <EventVenueCard assetId={entity.asset_id} />
    ) : null,
  getViewRoute: id => ROUTES.EVENTS.VIEW(id),
  getCoverImages: entity => {
    const images = Array.isArray(entity.images) ? (entity.images as string[]) : [];
    return [entity.banner_url as string, entity.thumbnail_url as string, ...images].filter(Boolean);
  },
  getJsonLdExtra: entity => {
    const place = eventPlaceLine(entity);
    const ticket = ticketOf(entity);
    const hasPin = hasMapPin(entity);
    return {
      ...(entity.start_date && { startDate: entity.start_date }),
      ...(entity.end_date && { endDate: entity.end_date }),
      ...(place && {
        location: {
          '@type': 'Place',
          name: place,
          ...(hasPin && {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: Number(entity.latitude),
              longitude: Number(entity.longitude),
            },
          }),
        },
      }),
      ...(ticket && {
        offers: { '@type': 'Offer', price: ticket.amount, priceCurrency: ticket.currency },
      }),
      ...(entity.max_attendees && { maximumAttendeeCapacity: entity.max_attendees }),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    };
  },
  renderDetails: (entity, _payable, isOwner, isSignedIn) => {
    // When, where and joining online lead the page (EventEssentials); this
    // card keeps the rest, and is left out when there is no rest.
    const genres = genresOf(entity);
    const vibe = typeof entity.vibe === 'string' && entity.vibe.trim() ? entity.vibe.trim() : null;
    const videoUrl = safeHref(entity.video_url);
    const recurrence = formatRecurrence(entity.is_recurring, entity.recurrence_pattern);
    const capacity = typeof entity.max_attendees === 'number' ? entity.max_attendees : null;
    const rsvpBy =
      typeof entity.rsvp_deadline === 'string'
        ? formatEventDate(entity.rsvp_deadline, eventZone(entity))
        : null;
    const hasMore = !!(recurrence || genres.length || vibe || videoUrl || capacity || rsvpBy);
    return (
      <>
        {hasMore && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* A repeating event used to render identically to a one-off — the
                whole recurrence rule was collected and shown nowhere. */}
              {recurrence && (
                <DetailRow icon={Repeat}>
                  <span className="font-medium">{recurrence}</span>
                </DetailRow>
              )}
              {genres.length > 0 && (
                <DetailRow icon={Music}>
                  <div className="flex flex-wrap gap-2">
                    {genres.map(genre => (
                      <span
                        key={genre}
                        className="rounded-full border border-default px-3 py-1 text-sm text-fg-primary"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}
              {vibe && <DetailRow icon={Sparkles}>{vibe}</DetailRow>}
              {videoUrl && (
                <DetailRow icon={Film}>
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium underline underline-offset-4"
                  >
                    Watch the video
                  </a>
                </DetailRow>
              )}
              {capacity && (
                <DetailRow icon={Users}>
                  <span className="font-medium">Max {capacity} attendees</span>
                </DetailRow>
              )}
              {rsvpBy && (
                <DetailRow icon={Clock}>
                  <span className="font-medium">RSVP by {rsvpBy}</span>
                </DetailRow>
              )}
            </CardContent>
          </Card>
        )}
        <EventCrewCard
          eventId={entity.id as string}
          eventTitle={entity.title as string}
          eventPath={ROUTES.EVENTS.VIEW(entity.id as string)}
          organizerUserId={(entity.user_id as string) ?? null}
          isOwner={isOwner}
          isSignedIn={isSignedIn}
          currency={(entity.currency as string) || 'CHF'}
        />
      </>
    );
  },
};

/** What a visitor is told about the event's state — only what changes their plans. */
const VISITOR_STATUS: Record<string, string> = {
  full: 'Full',
  ongoing: 'Happening now',
};

function DetailRow({ icon: Icon, children }: { icon: typeof Music; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
        <Icon className="h-5 w-5 text-fg-primary" />
      </div>
      <div className="min-w-0 break-words pt-2">{children}</div>
    </div>
  );
}
