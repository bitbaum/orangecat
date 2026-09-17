/**
 * Group Event Detail Page
 *
 * /groups/[slug]/events/[eventId]
 *
 * EventCard ("View Details") has always linked here, but the page never
 * existed — every click 404'd. Read-only detail view: full description,
 * schedule, location, and attendee list. Mirrors the group proposal detail
 * page pattern (server component, direct queries, group-scoped access).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Users, ArrowLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { resolveGroupBySlug, checkGroupMember } from '@/domain/groups/helpers.server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { formatShortTime } from '@/utils/dates';
import type { GroupEvent } from '@/services/groups/types';
import { FormattedDate } from '@/components/ui/FormattedDate';

interface PageProps {
  params: Promise<{ slug: string; eventId: string }>;
}

type EventRow = GroupEvent & {
  rsvps?: Array<{ id: string; user_id: string; status: string }>;
};
type ProfileLite = { id: string; name: string | null };

export default async function GroupEventDetailPage({ params }: PageProps) {
  const { slug, eventId } = await params;
  const supabase = await createServerClient();

  const group = await resolveGroupBySlug(supabase, slug);
  if (!group) {
    notFound();
  }

  // NOTE: no `profiles` embeds here — the live DB has no FK from
  // group_events.creator_id / group_event_rsvps.user_id to profiles, so
  // PostgREST embeds fail (PGRST200). Names are resolved with one extra query.
  const { data: eventData } = await supabase
    .from(DATABASE_TABLES.GROUP_EVENTS)
    .select('*, rsvps:group_event_rsvps (id, user_id, status)')
    .eq('id', eventId)
    .eq('group_id', group.id)
    .single();

  const event = eventData as unknown as EventRow | null;
  if (!event) {
    notFound();
  }

  // Private events are members-only — same rule as the API route.
  if (!event.is_public) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !(await checkGroupMember(supabase, group.id, user.id))) {
      notFound();
    }
  }

  const groupHref = `${ENTITY_REGISTRY['group'].publicBasePath}/${slug}`;
  const startDate = new Date(event.starts_at);
  const endDate = event.ends_at ? new Date(event.ends_at) : null;
  const isPast = startDate < new Date();
  const attendees = (event.rsvps || []).filter(r => r.status === STATUS.GROUP_EVENT_RSVPS.GOING);

  // Resolve creator + attendee display names in one query.
  const profileIds = [...new Set([event.creator_id, ...attendees.map(r => r.user_id)])].filter(
    Boolean
  );
  const { data: profilesData } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id, name')
    .in('id', profileIds);
  const profileById = new Map(
    ((profilesData || []) as unknown as ProfileLite[]).map(p => [p.id, p])
  );
  const creatorName = profileById.get(event.creator_id)?.name || null;

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Breadcrumb
          items={[
            {
              label: ENTITY_REGISTRY['group'].namePlural,
              href: ENTITY_REGISTRY['group'].publicBasePath,
            },
            { label: group.name || slug, href: groupHref },
            { label: event.title },
          ]}
        />

        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-fg-primary">{event.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline">{event.event_type}</Badge>
              {event.is_public && <Badge variant="secondary">Public</Badge>}
              {isPast && <Badge variant="secondary">Past</Badge>}
            </div>
          </div>
          {creatorName && (
            <p className="mt-1 text-sm text-fg-secondary">Organized by {creatorName}</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            {event.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About this Event</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-fg-secondary">{event.description}</p>
                </CardContent>
              </Card>
            )}

            {event.requires_rsvp && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Attendees ({attendees.length}
                    {event.max_attendees ? ` / ${event.max_attendees}` : ''})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attendees.length === 0 ? (
                    <p className="text-sm text-fg-secondary">No RSVPs yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {attendees.map(rsvp => (
                        <li key={rsvp.id} className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-fg-tertiary" />
                          <span>{profileById.get(rsvp.user_id)?.name || 'Member'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">When &amp; Where</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-fg-secondary">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    <FormattedDate value={startDate} /> {formatShortTime(startDate)}
                  </span>
                </div>
                {endDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      Ends: <FormattedDate value={endDate} /> {formatShortTime(endDate)}
                    </span>
                  </div>
                )}
                {event.location_details && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{event.location_details}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Link
              href={groupHref}
              className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {group.name || 'group'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
