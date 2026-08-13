/**
 * Group API Helpers (server-only)
 *
 * Shared lookup and permission helpers used by group-related API routes.
 */

import { DATABASE_TABLES } from '@/config/database-tables';

type AnyClient = any;

/**
 * Resolve the group fields shared by server routes, or null if not found.
 */
export async function resolveGroupBySlug(
  supabase: AnyClient,
  slug: string
): Promise<{ id: string; name?: string; is_public: boolean } | null> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('id, name, is_public')
    .eq('slug', slug)
    .single();
  if (error || !data) {
    return null;
  }
  return data as { id: string; name?: string; is_public: boolean };
}

/**
 * Check if a user is a group admin (founder or admin role).
 * Returns the role string if they are, null otherwise.
 */
export async function checkGroupAdmin(
  supabase: AnyClient,
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
  supabase: AnyClient,
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
  supabase: AnyClient,
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
