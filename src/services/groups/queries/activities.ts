/**
 * Groups Activity Query Functions
 *
 * Handles activity tracking queries for groups.
 * Unified for both circles and organizations.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created unified activity queries
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { GroupActivitiesResponse, GroupActivitiesQuery } from '../types';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { checkGroupPermission } from '../permissions';
import { getCurrentUserId } from '../utils/helpers';
import { groupContentIsOpen } from '../utils/visibility';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '../db-helpers';

/**
 * Get group activities
 */
export async function getGroupActivities(
  groupId: string,
  query?: GroupActivitiesQuery,
  pagination?: { page?: number; pageSize?: number },
  client?: AnySupabaseClient
): Promise<GroupActivitiesResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);

    // Check permissions
    if (userId) {
      const canView = await checkGroupPermission(groupId, userId, 'canView', sb);
      if (!canView) {
        return { success: false, error: 'Cannot view group activities' };
      }
    } else {
      // Signed out: only a group whose content is open shows its activity.
      const { data: group } = await fromTable(sb, DATABASE_TABLES.GROUPS)
        .select('is_public, visibility')
        .eq('id', groupId)
        .single();

      if (!group || !groupContentIsOpen(group)) {
        return { success: false, error: 'Cannot view group activities' };
      }
    }

    let dbQuery = fromTable(sb, DATABASE_TABLES.GROUP_ACTIVITIES)
      .select('*', { count: 'exact' })
      .eq('group_id', groupId);

    // Apply filters
    if (query?.activity_type) {
      dbQuery = dbQuery.eq('activity_type', query.activity_type);
    }
    if (query?.user_id) {
      dbQuery = dbQuery.eq('user_id', query.user_id);
    }
    if (query?.from_date) {
      dbQuery = dbQuery.gte('created_at', query.from_date);
    }
    if (query?.to_date) {
      dbQuery = dbQuery.lte('created_at', query.to_date);
    }

    // Apply sorting
    const sortBy = query?.sort_by || 'created_at';
    const sortOrder = query?.sort_order || 'desc';
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const pageSize = Math.min(pagination?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const page = pagination?.page || 1;
    const offset = (page - 1) * pageSize;

    dbQuery = dbQuery.range(offset, offset + pageSize - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error('Failed to get group activities', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true, activities: data || [], total: count || 0 };
  } catch (error) {
    logger.error('Exception getting group activities', error, 'Groups');
    return { success: false, error: 'Failed to get group activities' };
  }
}
