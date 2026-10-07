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
  /** Who is in the role — at most `quantity` people. */
  assignee_user_ids: string[];
  /** People in this role can check guests in at the door. */
  can_check_in: boolean;
}

const SELECT =
  'id, event_id, role_title, quantity, engagement_type, fee_amount, description, status, assignee_user_ids, can_check_in';

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
        can_check_in: r.can_check_in,
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

/** Why an assignment did not happen, in words the organizer can act on. */
export class CrewAssignError extends Error {}

async function readRole(supabase: AnySupabaseClient, roleId: string): Promise<EventRole> {
  const { data } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .select(SELECT)
    .eq('id', roleId)
    .maybeSingle();
  if (!data) {
    throw new CrewAssignError('Role not found');
  }
  return data as EventRole;
}

async function writeAssignees(
  supabase: AnySupabaseClient,
  role: EventRole,
  assignees: string[]
): Promise<EventRole> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .update({
      assignee_user_ids: assignees,
      status: assignees.length >= role.quantity ? 'filled' : 'open',
    })
    .eq('id', role.id)
    .select(SELECT)
    .maybeSingle();
  if (error || !data) {
    throw new CrewAssignError(error?.message ?? 'Only the organizer can change the crew');
  }
  return data as EventRole;
}

/**
 * Put a person in a role. It fills when it holds as many people as it asked
 * for, and the table refuses more. Owner-only by RLS: someone else's role
 * comes back as no row.
 */
export async function assignToRole(
  supabase: AnySupabaseClient,
  roleId: string,
  userId: string
): Promise<EventRole> {
  const role = await readRole(supabase, roleId);
  if (role.assignee_user_ids.includes(userId)) {
    return role;
  }
  if (role.assignee_user_ids.length >= role.quantity) {
    throw new CrewAssignError(
      `${role.role_title} already has ${role.quantity} — take someone off first.`
    );
  }
  return writeAssignees(supabase, role, [...role.assignee_user_ids, userId]);
}

/** Take a person out of a role; it reopens. */
export async function unassignFromRole(
  supabase: AnySupabaseClient,
  roleId: string,
  userId: string
): Promise<EventRole> {
  const role = await readRole(supabase, roleId);
  return writeAssignees(
    supabase,
    role,
    role.assignee_user_ids.filter(id => id !== userId)
  );
}

/** Whether this person may check guests in at the event (organizer or door crew). */
export async function canCheckInAt(
  supabase: AnySupabaseClient,
  eventId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase.rpc('can_check_in_at', {
    p_event_id: eventId,
    p_user_id: userId,
  });
  return data === true;
}

/** The fee one person in the role is paid, in the event's currency (null: unpaid). */
export async function setRoleFee(
  supabase: AnySupabaseClient,
  roleId: string,
  fee: number | null
): Promise<EventRole> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .update({ fee_amount: fee })
    .eq('id', roleId)
    .select(SELECT)
    .maybeSingle();
  if (error || !data) {
    throw new CrewAssignError(error?.message ?? 'Only the organizer can set a fee');
  }
  return data as EventRole;
}
