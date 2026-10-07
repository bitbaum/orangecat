/**
 * "Crew wanted" — the people this event needs, on its public page.
 *
 * Visitors see each open role with a one-tap way to offer themselves: a
 * message to the organizer that already says which role and which event. The
 * organizer sees the same list plus the controls to add, fill and remove roles.
 * Async server component: reads event_roles under the visitor's RLS.
 */

import Link from 'next/link';
import { DoorOpen, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import { ENGAGEMENT_LABELS } from '@/config/project-roles';
import { listEventRoles, type EventRole } from '@/domain/events/crew';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import EventCrewManager from './EventCrewManager';
import type { CrewPerson } from './CrewRoleRow';
import { DATABASE_TABLES } from '@/config/database-tables';

interface EventCrewCardProps {
  eventId: string;
  eventTitle: string;
  eventPath: string;
  organizerUserId: string | null;
  isOwner: boolean;
  isSignedIn: boolean;
}

/** "2× Bartender" — or "1 more Bartender" once some places are taken. */
function openLabel(role: EventRole): string {
  const left = role.quantity - role.assignee_user_ids.length;
  if (role.assignee_user_ids.length > 0) {
    return `${left} more ${role.role_title}`;
  }
  return role.quantity > 1 ? `${role.quantity}× ${role.role_title}` : role.role_title;
}

/** Names of everyone in a role, for the organizer's card. */
async function crewNames(
  supabase: AnySupabaseClient,
  roles: EventRole[]
): Promise<Record<string, CrewPerson>> {
  const ids = [...new Set(roles.flatMap(r => r.assignee_user_ids))];
  if (ids.length === 0) {
    return {};
  }
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name')
    .in('id', ids);
  return Object.fromEntries(
    ((data ?? []) as Array<{ id: string; username: string; name: string | null }>).map(p => [
      p.id,
      { username: p.username, name: p.name },
    ])
  );
}

export default async function EventCrewCard({
  eventId,
  eventTitle,
  eventPath,
  organizerUserId,
  isOwner,
  isSignedIn,
}: EventCrewCardProps) {
  let roles: EventRole[] = [];
  let viewerId: string | null = null;
  let people: Record<string, CrewPerson> = {};
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    const [list, auth] = await Promise.all([
      listEventRoles(supabase, eventId),
      supabase.auth.getUser(),
    ]);
    roles = list;
    viewerId = auth.data.user?.id ?? null;
    if (isOwner) {
      people = await crewNames(supabase, roles);
    }
  } catch (error) {
    logger.warn('Could not load event crew', { eventId, error: String(error) }, 'EventRoles');
  }

  if (isOwner) {
    return <EventCrewManager eventId={eventId} initialRoles={roles} initialPeople={people} />;
  }

  const mine = viewerId ? roles.filter(r => r.assignee_user_ids.includes(viewerId)) : [];
  const open = roles.filter(r => r.status === 'open' && r.assignee_user_ids.length < r.quantity);
  if (open.length === 0 && mine.length === 0) {
    return null;
  }

  const offerHref = (role: EventRole) => {
    const query = new URLSearchParams({
      ...(organizerUserId && { to: organizerUserId }),
      about: `${role.role_title} at ${eventTitle}`,
      ref: eventPath,
    }).toString();
    const href = `${ROUTES.MESSAGES}?${query}`;
    return isSignedIn ? href : `${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(href)}`;
  };

  const crewCard = mine.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          You&apos;re on the crew
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-fg-primary">{mine.map(r => r.role_title).join(', ')}</p>
        {mine.some(r => r.can_check_in) && (
          <Link
            href={`${eventPath}/door`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
          >
            <DoorOpen className="h-4 w-4" />
            Open the door list
          </Link>
        )}
      </CardContent>
    </Card>
  );

  if (open.length === 0) {
    return crewCard;
  }

  return (
    <>
      {crewCard}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Crew wanted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-default">
            {open.map(role => (
              <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="break-words font-medium text-fg-primary">{openLabel(role)}</div>
                  <div className="text-sm text-fg-secondary">
                    {ENGAGEMENT_LABELS[role.engagement_type] ?? role.engagement_type}
                    {role.description ? ` · ${role.description}` : ''}
                  </div>
                </div>
                {organizerUserId && (
                  <Link
                    href={offerHref(role)}
                    className="flex min-h-11 items-center rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
                  >
                    I can do this
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
