'use client';

/**
 * "Add to calendar" — one button, the right file for the phone in hand.
 *
 * iPhones and computers open an .ics file straight into their calendar; most
 * Android phones only download it, so there the button opens Google
 * Calendar's add page instead. The person never chooses between formats.
 */

import { useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';

interface AddToCalendarProps {
  eventId: string;
  /** Google Calendar's add page for this event (googleCalendarHref). */
  googleHref: string;
  className?: string;
}

export default function AddToCalendar({ eventId, googleHref, className }: AddToCalendarProps) {
  const icsHref = API_ROUTES.EVENTS.CALENDAR(eventId);
  const [href, setHref] = useState(icsHref);
  useEffect(() => {
    if (/android/i.test(navigator.userAgent)) {
      setHref(googleHref);
    }
  }, [googleHref]);
  const external = href !== icsHref;
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={
        className ??
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised'
      }
    >
      <CalendarPlus className="h-4 w-4" />
      Add to calendar
    </a>
  );
}
