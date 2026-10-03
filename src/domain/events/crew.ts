/**
 * Event crew — the people a gathering needs to happen (DJ, bartenders, sound).
 *
 * One read and one write, used by the public event page, the event-roles API
 * and the Cat's create_event. RLS on event_roles is the real gate (public read
 * when the event is readable, owner-only write); this module only shapes rows.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { EngagementType, RoleStatus } from '@/config/project-roles';
import type { ParsedCrewRole } from '@/config/event-crew';

export interface EventRole {
  id: string;
  event_id: string;
  role_title: string;
  quantity: number;
  engagement_type: EngagementType;
  fee_amount: number | null;
  description: string | null;
  status: RoleStatus;
}

const SELECT =
  'id, event_id, role_title, quantity, engagement_type, fee_amount, description, status';

export interface NewEventRole extends ParsedCrewRole {
  fee_amount?: number | null;
  description?: string | null;
}

export async function listEventRoles(
  supabase: AnySupabaseClient,
  eventId: string
): Promise<EventRole[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .select(SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as EventRole[];
}

export async function addEventRoles(
  supabase: AnySupabaseClient,
  eventId: string,
  roles: NewEventRole[]
): Promise<EventRole[]> {
  if (roles.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .insert(
      roles.map(r => ({
        event_id: eventId,
        role_title: r.role_title,
        quantity: r.quantity,
        engagement_type: r.engagement_type,
        fee_amount: r.fee_amount ?? null,
        description: r.description ?? null,
      }))
    )
    .select(SELECT);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as EventRole[];
}

/** "1 DJ, 2 bartenders" — the crew as one line, for chat replies and summaries. */
export function describeCrew(roles: Pick<EventRole, 'role_title' | 'quantity'>[]): string {
  return roles
    .map(r => (r.quantity > 1 ? `${r.quantity}× ${r.role_title}` : r.role_title))
    .join(', ');
}

/**
 * Change one role's status. RLS only lets the event's owner write, so a role
 * that is not theirs comes back as no row — returned as null, not thrown.
 */
export async function setEventRoleStatus(
  supabase: AnySupabaseClient,
  roleId: string,
  status: RoleStatus
): Promise<EventRole | null> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .update({ status })
    .eq('id', roleId)
    .select(SELECT)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as EventRole | null) ?? null;
}

/** Remove one role; false when it was not the caller's to remove (or is gone). */
export async function removeEventRole(
  supabase: AnySupabaseClient,
  roleId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .delete()
    .eq('id', roleId)
    .select('id');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).length > 0;
}
