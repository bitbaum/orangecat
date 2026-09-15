/**
 * Groups Service Helper Functions
 *
 * Shared utility functions for the groups service.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created helpers file
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getCurrentUserId as getSharedCurrentUserId } from '@/services/supabase/auth/session';
import { fromTable } from '../db-helpers';

/**
 * Get current authenticated user ID.
 *
 * With no client this is the shared, cached answer from the auth layer. With an
 * explicit client it asks that client directly and caches nothing: a caller
 * passing its own client is usually passing a per-request server client, and a
 * module-level cache there would hand one request's user to the next.
 */
export async function getCurrentUserId(client?: AnySupabaseClient): Promise<string | null> {
  if (!client) {
    return getSharedCurrentUserId();
  }
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    return user?.id || null;
  } catch (error) {
    logger.error('Error getting current user ID', error, 'Groups');
    return null;
  }
}

/**
 * Ensure slug is unique by appending number if needed
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  excludeId?: string,
  client?: AnySupabaseClient
): Promise<string> {
  const supabaseClient = client || supabase;
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data } = await fromTable(supabaseClient, DATABASE_TABLES.GROUPS)
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!data || (excludeId && data.id === excludeId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Get user's group IDs for permission checks
 */
export async function getUserGroupIds(
  userId: string,
  client?: AnySupabaseClient
): Promise<string[]> {
  try {
    const sb = client || supabase;

    const { data } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .select('group_id')
      .eq('user_id', userId);

    return data?.map((m: { group_id: string }) => m.group_id) || [];
  } catch (error) {
    logger.error('Error getting user group IDs', error, 'Groups');
    return [];
  }
}

/**
 * Check if a user is a member of a group
 */
export async function isGroupMember(
  groupId: string,
  userId: string,
  client?: AnySupabaseClient
): Promise<boolean> {
  try {
    const sb = client || supabase;

    const { data } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    return !!data;
  } catch (error) {
    logger.error('Error checking group membership', error, 'Groups');
    return false;
  }
}

/**
 * Get user's role in a group
 */
export async function getUserRole(
  groupId: string,
  userId: string,
  client?: AnySupabaseClient
): Promise<'founder' | 'admin' | 'member' | null> {
  try {
    const sb = client || supabase;

    const { data } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    return (data?.role as 'founder' | 'admin' | 'member') || null;
  } catch (error) {
    logger.error('Error getting user role', error, 'Groups');
    return null;
  }
}
