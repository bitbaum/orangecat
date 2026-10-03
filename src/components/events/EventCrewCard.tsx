/**
 * "Crew wanted" — the people this event needs, on its public page.
 *
 * Visitors see each open role with a one-tap way to offer themselves: a
 * message to the organizer that already says which role and which event. The
 * organizer sees the same list plus the controls to add, fill and remove roles.
 * Async server component: reads event_roles under the visitor's RLS.
 */

import Link from 'next/link';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import { ENGAGEMENT_LABELS } from '@/config/project-roles';
import { listEventRoles, type EventRole } from '@/domain/events/crew';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import EventCrewManager from './EventCrewManager';

interface EventCrewCardProps {
  eventId: string;
  eventTitle: string;
  eventPath: string;
  organizerUserId: string | null;
  isOwner: boolean;
  isSignedIn: boolean;
}

function roleLabel(role: Pick<EventRole, 'role_title' | 'quantity'>): string {
  return role.quantity > 1 ? `${role.quantity}× ${role.role_title}` : role.role_title;
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
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    roles = await listEventRoles(supabase, eventId);
  } catch (error) {
    logger.warn('Could not load event crew', { eventId, error: String(error) }, 'EventRoles');
  }

  if (isOwner) {
    return <EventCrewManager eventId={eventId} initialRoles={roles} />;
  }

  const open = roles.filter(r => r.status === 'open');
  if (open.length === 0) {
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

  return (
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
                <div className="break-words font-medium text-fg-primary">{roleLabel(role)}</div>
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
  );
}
