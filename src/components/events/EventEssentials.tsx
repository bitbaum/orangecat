/**
 * The top of an event page: when, where, and the two things a guest does
 * with them — put it in their calendar, and find the door.
 *
 * Most people reach an event page from a link a friend dropped in a group
 * chat, on a phone. They want three answers, in this order: when is it,
 * where is it, am I in. This block is the first two; the ticket box right
 * under it is the third. Everything else on the page can wait below.
 */

import { Calendar as CalendarIcon, MapPin, Video } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';
import { safeHref } from '@/lib/security/safeHref';
import { directionsHref, googleCalendarHref } from '@/domain/events/calendar';
import { eventPlaceText } from '@/domain/events/place';
import { eventZone, formatEventClockRange, formatEventDay, zoneLabel } from '@/domain/events/time';
import CalendarAndDirections from './CalendarAndDirections';

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

/** The structured venue fields, in postal order, as display lines. */
export function addressLines(event: Record<string, unknown>): string[] {
  const cityLine = [text(event.venue_postal_code), text(event.venue_city)]
    .filter(Boolean)
    .join(' ');
  return [
    text(event.venue_name),
    text(event.venue_address),
    cityLine,
    text(event.venue_country),
  ].filter((part): part is string => !!part);
}

export default function EventEssentials({ event }: { event: Record<string, unknown> }) {
  const id = event.id as string;
  const start = text(event.start_date);
  const zone = eventZone(event);
  const address = addressLines(event);
  const directions = directionsHref(event);
  const joinUrl = safeHref(event.online_url);
  const googleHref = start
    ? googleCalendarHref({
        id,
        title: String(event.title ?? ''),
        start_date: start,
        end_date: text(event.end_date),
        is_all_day: Boolean(event.is_all_day),
        timezone: zone,
        place: eventPlaceText(event),
        url: `${SITE_URL}${ROUTES.EVENTS.VIEW(id)}`,
      })
    : null;

  if (!start && address.length === 0 && !joinUrl) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {start && (
          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg-secondary" />
            <div className="min-w-0">
              <div className="font-semibold text-fg-primary">{formatEventDay(start, zone)}</div>
              <div className="text-fg-secondary">
                {event.is_all_day
                  ? 'All day'
                  : `${formatEventClockRange(start, text(event.end_date), zone)} · ${zoneLabel(zone)}`}
              </div>
            </div>
          </div>
        )}
        {address.length > 0 && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg-secondary" />
            <div className="min-w-0">
              <div className="break-words font-semibold text-fg-primary">{address[0]}</div>
              {address.slice(1).map(line => (
                <div key={line} className="break-words text-fg-secondary">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
        {joinUrl && (
          <div className="flex items-start gap-3">
            <Video className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg-secondary" />
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-semibold text-fg-primary underline underline-offset-4"
            >
              Join online
            </a>
          </div>
        )}
        <CalendarAndDirections eventId={id} googleHref={googleHref} directions={directions} />
      </CardContent>
    </Card>
  );
}
