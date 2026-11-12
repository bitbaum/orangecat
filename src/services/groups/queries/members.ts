/**
 * Groups Member Query Functions
 *
 * Handles member/stakeholder queries for groups.
 * Unified for both circles and organizations.
 *
 * Created: 2025-01-30
 * Last Modified: 2026-03-31
 * Last Modified Summary: Consolidate as-any casts into db-helpers
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type { GroupMembersResponse, GroupMemberDetail } from '../types';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { checkGroupPermission } from '../permissions';
import { getCurrentUserId } from '../utils/helpers';
import { groupContentIsOpen } from '../utils/visibility';
import { fromTable, type AnySupabaseClient } from '../db-helpers';

interface MemberRow {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  invited_by: string | null;
  permission_overrides: Record<string, unknown> | null;
  profiles: {
    id: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Get group members/stakeholders
 */
export async function getGroupMembers(
  groupId: string,
  pagination?: { page?: number; pageSize?: number },
  client?: AnySupabaseClient
): Promise<GroupMembersResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);

    // Check if user can view members
    if (userId) {
      const canView = await checkGroupPermission(groupId, userId, 'canView', sb);
      if (!canView) {
        return { success: false, error: 'Cannot view group members' };
      }
    } else {
      // Signed out: only a group whose content is open shows its members.
      const { data: groupData } = await fromTable(sb, DATABASE_TABLES.GROUPS)
        .select('is_public, visibility')
        .eq('id', groupId)
        .single();

      const group = groupData as { is_public: boolean; visibility: string | null } | null;

      if (!group || !groupContentIsOpen(group)) {
        return { success: false, error: 'Cannot view group members' };
      }
    }

    // Build query
    let query = fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          name,
          avatar_url
        )
      `,
        { count: 'exact' }
      )
      .eq('group_id', groupId);

    // Apply pagination
    const pageSize = Math.min(pagination?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const page = pagination?.page || 1;
    const offset = (page - 1) * pageSize;

    query = query.range(offset, offset + pageSize - 1).order('joined_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to get group members', error, 'Groups');
      return { success: false, error: error.message };
    }

    // Transform to GroupMemberDetail format
    const rows = (data || []) as MemberRow[];
    const members: GroupMemberDetail[] = rows.map(member => ({
      id: member.id,
      group_id: member.group_id,
      user_id: member.user_id,
      role: member.role,
      role_type: member.role, // Map role to role_type for compatibility
      status: STATUS.GROUP_MEMBER_STATUS.ACTIVE,
      joined_at: member.joined_at,
      invited_by: member.invited_by || null,
      voting_weight: 1.0, // group_members doesn't have voting_weight, use default
      equity_percentage: null, // group_members doesn't have equity_percentage
      permissions: member.permission_overrides || null,
      username: member.profiles?.username || null,
      display_name: member.profiles?.name || null,
      avatar_url: member.profiles?.avatar_url || null,
    }));

    return { success: true, members, total: count || 0 };
  } catch (error) {
    logger.error('Exception getting group members', error, 'Groups');
    return { success: false, error: 'Failed to get group members' };
  }
}
