/**
 * "At Espresso Bar" — the event's venue page, in the event's sidebar.
 * Async server component; renders nothing when the venue is gone or hidden.
 */

import Link from 'next/link';
import { Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { createServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import { getVenueGroup, venueAddressLine } from '@/domain/events/venue-page';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export default async function EventVenueCard({ groupId }: { groupId: string }) {
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  const venue = await getVenueGroup(supabase, groupId).catch(() => null);
  if (!venue) {
    return null;
  }
  const address = venueAddressLine(venue);
  return (
    <Card>
      <CardContent className="pt-6">
        <Link
          href={ROUTES.GROUPS.VIEW(venue.slug)}
          className="flex items-center gap-3 rounded-md transition-colors hover:bg-surface-raised"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised/40">
            <Store className="h-5 w-5 text-fg-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-fg-secondary">At</div>
            <div className="break-words font-medium text-fg-primary">{venue.name}</div>
            {address && <div className="break-words text-sm text-fg-secondary">{address}</div>}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
