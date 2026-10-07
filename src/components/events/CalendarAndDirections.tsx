/**
 * The two things a guest does with "when" and "where": keep the date, find
 * the door. Shared by the event page and the guest's ticket page — the page
 * they actually open on the night.
 */

import { Navigation } from 'lucide-react';
import AddToCalendar from './AddToCalendar';

interface CalendarAndDirectionsProps {
  eventId: string;
  googleHref: string | null;
  directions: string | null;
}

export default function CalendarAndDirections({
  eventId,
  googleHref,
  directions,
}: CalendarAndDirectionsProps) {
  if (!googleHref && !directions) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {googleHref && <AddToCalendar eventId={eventId} googleHref={googleHref} />}
      {directions && (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
        >
          <Navigation className="h-4 w-4" />
          Directions
        </a>
      )}
    </div>
  );
}
