/**
 * Event Card Component
 *
 * Displays a single event in a card format.
 *
 * Created: 2025-12-31
 * Last Modified: 2025-12-31
 * Last Modified Summary: Initial implementation
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import Link from 'next/link';
import type { GroupEvent } from '@/services/groups/types';
import { STATUS } from '@/config/database-constants';
import { formatShortTime } from '@/utils/dates';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { FormattedDate } from '@/components/ui/FormattedDate';

interface EventCardProps {
  event: GroupEvent & {
    creator?: { id: string; name: string | null; avatar_url: string | null };
    rsvps?: Array<{
      id: string;
      user_id: string;
      status: string;
      user?: { id: string; name: string | null; avatar_url: string | null };
    }>;
  };
  groupSlug: string;
  onUpdate?: () => void;
}

export function EventCard({ event, groupSlug, onUpdate: _onUpdate }: EventCardProps) {
  const startDate = new Date(event.starts_at);
  const endDate = event.ends_at ? new Date(event.ends_at) : null;
  const isPast = startDate < new Date();
  const rsvpCount =
    event.rsvps?.filter(r => r.status === STATUS.GROUP_EVENT_RSVPS.GOING).length || 0;

  return (
    <Card className="oc-card-link">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{event.title}</CardTitle>
            <CardDescription className="line-clamp-2">{event.description}</CardDescription>
          </div>
          {isPast && <Badge variant="secondary">Past</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <Calendar className="h-4 w-4" />
          <span>
            <FormattedDate value={startDate} /> {formatShortTime(startDate)}
          </span>
        </div>

        {endDate && (
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <Clock className="h-4 w-4" />
            <span>
              Ends: <FormattedDate value={endDate} /> {formatShortTime(endDate)}
            </span>
          </div>
        )}

        {event.location_details && (
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{event.location_details}</span>
          </div>
        )}

        {event.requires_rsvp && (
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <Users className="h-4 w-4" />
            <span>
              {rsvpCount} {rsvpCount === 1 ? 'person' : 'people'} going
              {event.max_attendees && ` / ${event.max_attendees} max`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Badge variant="outline">{event.event_type}</Badge>
          {event.is_public && <Badge variant="secondary">Public</Badge>}
        </div>

        <Link href={`${ENTITY_REGISTRY['group'].publicBasePath}/${groupSlug}/events/${event.id}`}>
          <Button variant="outline" className="w-full mt-2">
            View Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
