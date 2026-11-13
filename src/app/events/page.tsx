import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * /events is the list of events, like every other kind's address: Discover
 * with the kind chosen, where "What's on near you" sits above the grid. It
 * used to be an organiser sales page at the event entity's public address, so
 * someone looking for something to go to met a pitch for selling tickets.
 */
export default function EventsPage() {
  redirect(ROUTES.DISCOVER_TYPE('events'));
}
