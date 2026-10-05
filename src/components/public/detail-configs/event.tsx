import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  Video,
  Clock,
  Repeat,
  Film,
  Music,
  Sparkles,
} from 'lucide-react';
import { safeHref } from '@/lib/security/safeHref';
import { formatRecurrence } from '@/lib/recurrence';
import EventCrewCard from '@/components/events/EventCrewCard';
import EventTicketCard from '@/components/events/EventTicketCard';
import EventVenueCard from '@/components/events/EventVenueCard';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';

/**
 * One line naming the place: venue + city when known. Shared by the page
 * metadata and the JSON-LD. Events have no `location` column — reading one
 * made every event page's metadata query fail into "Event Not Found".
 */
export const eventPlaceLine = (entity: Record<string, unknown>): string | null => {
  const parts = [entity.venue_name, entity.venue_address, entity.venue_city].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  );
  return parts.length > 0 ? parts.join(', ') : null;
};

/** The selected columns the page metadata reads — SSOT for both callers. */
export const EVENT_METADATA_SELECT =
  'title, description, start_date, venue_name, venue_address, venue_city, music_genres';

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

/** The structured venue fields, in postal order, as display lines. */
const addressLines = (entity: Record<string, unknown>): string[] => {
  const cityLine = [entity.venue_postal_code, entity.venue_city]
    .filter(part => typeof part === 'string' && part.trim())
    .join(' ');
  return [entity.venue_name, entity.venue_address, cityLine, entity.venue_country]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map(part => part.trim());
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
  visibilityFilter: { column: 'status', values: EVENT_PUBLIC_STATUSES },
  metadataSelect: EVENT_METADATA_SELECT,
  getPrice: ticketOf,
  renderSidebarExtra: entity =>
    typeof entity.venue_group_id === 'string' ? (
      <EventVenueCard groupId={entity.venue_group_id} />
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
  renderHeaderExtra: entity =>
    entity.start_date ? (
      <span className="text-fg-secondary text-sm">
        {format(new Date(entity.start_date as string), 'EEEE, MMMM d, yyyy')}
      </span>
    ) : null,
  renderDetails: (entity, _payable, isOwner, isSignedIn) => {
    const address = addressLines(entity);
    const genres = genresOf(entity);
    const vibe = typeof entity.vibe === 'string' && entity.vibe.trim() ? entity.vibe.trim() : null;
    const hasPin = hasMapPin(entity);
    const mapHref = hasPin
      ? `https://www.openstreetmap.org/?mlat=${entity.latitude}&mlon=${entity.longitude}#map=17/${entity.latitude}/${entity.longitude}`
      : null;
    const joinUrl = safeHref(entity.online_url);
    const videoUrl = safeHref(entity.video_url);
    const recurrence = formatRecurrence(entity.is_recurring, entity.recurrence_pattern);
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {entity.start_date && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <CalendarIcon className="h-5 w-5 text-fg-primary" />
                </div>
                <div>
                  <div className="font-medium">
                    {format(new Date(entity.start_date as string), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-fg-secondary">
                    {entity.is_all_day
                      ? 'All day'
                      : `${format(new Date(entity.start_date as string), 'h:mm a')}${
                          entity.end_date
                            ? ` - ${format(new Date(entity.end_date as string), 'h:mm a')}`
                            : ''
                        }`}
                  </div>
                </div>
              </div>
            )}
            {/* A repeating event used to render identically to a one-off — the
              whole recurrence rule was collected and shown nowhere. */}
            {recurrence && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Repeat className="h-5 w-5 text-fg-primary" />
                </div>
                <div className="min-w-0">
                  <div className="break-words font-medium">{recurrence}</div>
                </div>
              </div>
            )}
            {address.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <MapPin className="h-5 w-5 text-fg-primary" />
                </div>
                <div className="min-w-0">
                  <div className="break-words font-medium">{address[0]}</div>
                  {address.slice(1).map(line => (
                    <div key={line} className="break-words text-sm text-fg-secondary">
                      {line}
                    </div>
                  ))}
                  {mapHref && (
                    <a
                      href={mapHref}
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
            {genres.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Music className="h-5 w-5 text-fg-primary" />
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 pt-2">
                  {genres.map(genre => (
                    <span
                      key={genre}
                      className="rounded-full border border-default px-3 py-1 text-sm text-fg-primary"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {vibe && (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Sparkles className="h-5 w-5 text-fg-primary" />
                </div>
                <div className="min-w-0 pt-2">
                  <div className="break-words">{vibe}</div>
                </div>
              </div>
            )}
            {joinUrl && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Video className="h-5 w-5 text-fg-primary" />
                </div>
                <div className="min-w-0">
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium underline underline-offset-4"
                  >
                    Join online
                  </a>
                </div>
              </div>
            )}
            {videoUrl && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Film className="h-5 w-5 text-fg-primary" />
                </div>
                <div className="min-w-0">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium underline underline-offset-4"
                  >
                    Watch the video
                  </a>
                </div>
              </div>
            )}
            {entity.max_attendees && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Users className="h-5 w-5 text-fg-primary" />
                </div>
                <div>
                  <div className="font-medium">Max {entity.max_attendees as number} attendees</div>
                </div>
              </div>
            )}
            {entity.rsvp_deadline && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
                  <Clock className="h-5 w-5 text-fg-primary" />
                </div>
                <div>
                  <div className="font-medium">
                    RSVP by {format(new Date(entity.rsvp_deadline as string), 'MMMM d, yyyy')}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <EventTicketCard event={entity} isOwner={isOwner} />
        <EventCrewCard
          eventId={entity.id as string}
          eventTitle={entity.title as string}
          eventPath={ROUTES.EVENTS.VIEW(entity.id as string)}
          organizerUserId={(entity.user_id as string) ?? null}
          isOwner={isOwner}
          isSignedIn={isSignedIn}
        />
      </>
    );
  },
};
