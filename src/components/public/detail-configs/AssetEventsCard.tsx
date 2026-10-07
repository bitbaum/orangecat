/**
 * "Happening here" — the upcoming public events held at a place.
 *
 * An event names its venue through `events.asset_id`, but nothing read it
 * back: a studio's page showed a Book button and no sign that anything ever
 * happened there. A venue is defined as much by what happens in it as by its
 * square metres, so its page lists them. Server component — the asset page
 * renders on the server.
 */
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { createServerClient } from '@/lib/supabase/server';
import { looseClient } from '@/lib/supabase/untyped';
import { eventZone, formatEventShort } from '@/domain/events/time';

/** Statuses of an event a visitor can still go to. */
export const UPCOMING_EVENT_STATUSES = [
  STATUS.EVENTS.PUBLISHED,
  STATUS.EVENTS.OPEN,
  STATUS.EVENTS.FULL,
  STATUS.EVENTS.ONGOING,
] as const;

const MAX_EVENTS = 5;

interface VenueEvent {
  id: string;
  title: string;
  start_date: string | null;
  timezone: string | null;
}

export async function AssetEventsCard({ assetId }: { assetId: string }) {
  const supabase = await createServerClient();
  // Still running counts: an event that started yesterday and ends tomorrow
  // is happening here now.
  const today = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
  const { data } = await looseClient(supabase)
    .from(ENTITY_REGISTRY.event.tableName)
    .select('id, title, start_date, timezone')
    .eq('asset_id', assetId)
    .in('status', [...UPCOMING_EVENT_STATUSES])
    .or(`end_date.gte.${today},start_date.gte.${today}`)
    .order('start_date', { ascending: true })
    .limit(MAX_EVENTS);

  const events = (data ?? []) as VenueEvent[];
  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Happening here</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {events.map(event => (
            <li key={event.id}>
              <Link
                href={`${ENTITY_REGISTRY.event.publicBasePath}/${event.id}`}
                className="block rounded-md underline-offset-4 hover:underline"
              >
                <span className="block font-medium text-fg-primary">{event.title}</span>
                {event.start_date && (
                  <span className="block text-sm text-fg-secondary">
                    {formatEventShort(event.start_date, eventZone(event))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
