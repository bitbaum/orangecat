/**
 * Group API Helpers (server-only)
 *
 * Shared lookup and permission helpers used by group-related API routes.
 */

import { DATABASE_TABLES } from '@/config/database-tables';

import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * Resolve a group by slug. Returns { id, name } or null if not found.
 */
export async function resolveGroupBySlug(
  supabase: AnySupabaseClient,
  slug: string
): Promise<{ id: string; name?: string } | null> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('id, name')
    .eq('slug', slug)
    .single();
  if (error || !data) {
    return null;
  }
  return data as { id: string; name?: string };
}

/**
 * Check if a user is a group admin (founder or admin role).
 * Returns the role string if they are, null otherwise.
 */
export async function checkGroupAdmin(
  supabase: AnySupabaseClient,
  groupId: string,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.GROUP_MEMBERS)
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data || !['founder', 'admin'].includes(data.role)) {
    return null;
  }
  return data.role as string;
}

/**
 * Check if a user can edit/delete an event: creator OR group admin.
 */
export async function canEditEvent(
  supabase: AnySupabaseClient,
  groupId: string,
  userId: string,
  creatorId: string
): Promise<boolean> {
  if (creatorId === userId) {
    return true;
  }
  const role = await checkGroupAdmin(supabase, groupId, userId);
  return role !== null;
}

/**
 * Check if a user is a member of the group (any role).
 */
export async function checkGroupMember(
  supabase: AnySupabaseClient,
  groupId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from(DATABASE_TABLES.GROUP_MEMBERS)
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return data !== null;
}
