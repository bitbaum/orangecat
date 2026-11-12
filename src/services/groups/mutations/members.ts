/**
 * Groups Member Mutation Functions
 *
 * Handles member management operations (join, leave, update).
 * Uses only the new groups tables.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-12-29
 * Last Modified Summary: Simplified to use only new groups tables
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type { GroupMember, AddMemberInput, UpdateMemberInput } from '@/types/group';
import type { GroupMemberResponse } from '../types';
import { STATUS } from '@/config/database-constants';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getCurrentUserId, isGroupMember, getUserRole } from '../utils/helpers';
import { logGroupActivity } from '../utils/activity';
import { canPerformAction } from '../permissions/resolver';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ServiceResult } from '@/types/common';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { fromTable } from '../db-helpers';

/**
 * Join an open group as yourself.
 *
 * Through join_public_group (migration 20261112201000), which runs as definer:
 * group_members' own insert policy lets only a group's founder or admins add
 * people, so the direct insert this used to make was refused for everyone
 * else and nobody could ever join. The function decides who may join (a
 * listed group whose visibility is 'public', see utils/joining.ts), refuses an
 * existing member, and answers in plain words.
 */
export async function joinGroup(
  groupId: string,
  client?: AnySupabaseClient
): Promise<ServiceResult> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Sign in to join this group' };
    }

    const { data, error } = await sb.rpc('join_public_group', { p_group_id: groupId });
    if (error) {
      logger.error('Failed to join group', error, 'Groups');
      return { success: false, error: 'Could not join the group. Please try again.' };
    }

    // The function's own jsonb: `error` is a sentence meant for the person.
    const result = (data ?? {}) as { success?: boolean; error?: string };
    if (!result.success) {
      return { success: false, error: apiErrorMessage(result, 'Could not join the group.') };
    }

    await logGroupActivity(groupId, userId, 'joined_group', 'Joined the group', undefined, sb);

    return { success: true };
  } catch (error) {
    logger.error('Exception joining group', error, 'Groups');
    return { success: false, error: 'Failed to join group' };
  }
}

/**
 * Leave a group
 */
export async function leaveGroup(
  groupId: string,
  client?: AnySupabaseClient
): Promise<ServiceResult> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user is founder (founders can't leave)
    const role = await getUserRole(groupId, userId, sb);

    if (role === STATUS.GROUP_MEMBERS.FOUNDER) {
      return {
        success: false,
        error: 'Group founders cannot leave. Transfer ownership or delete the group.',
      };
    }

    if (!role) {
      return { success: false, error: 'Not a member of this group' };
    }

    // Remove membership
    const { error } = await sb
      .from(DATABASE_TABLES.GROUP_MEMBERS)
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to leave group', error, 'Groups');
      return { success: false, error: error.message };
    }

    // Log activity
    await logGroupActivity(groupId, userId, 'left_group', 'Left the group', undefined, sb);

    return { success: true };
  } catch (error) {
    logger.error('Exception leaving group', error, 'Groups');
    return { success: false, error: 'Failed to leave group' };
  }
}

/**
 * Add a member to a group (invite)
 */
export async function addMember(
  groupId: string,
  input: AddMemberInput,
  client?: AnySupabaseClient
): Promise<GroupMemberResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permissions
    const permResult = await canPerformAction(userId, groupId, 'invite_members', sb);
    if (!permResult.allowed) {
      return { success: false, error: permResult.reason || 'Insufficient permissions' };
    }

    // Check if target user is already a member
    const alreadyMember = await isGroupMember(groupId, input.user_id, sb);
    if (alreadyMember) {
      return { success: false, error: 'User is already a member' };
    }

    // Add member

    const { data, error } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .insert({
        group_id: groupId,
        user_id: input.user_id,
        role: input.role || 'member',
        invited_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to add member', error, 'Groups');
      return { success: false, error: error.message };
    }

    // Log activity
    await logGroupActivity(groupId, userId, 'member_added', `Invited a new member`, undefined, sb);

    return { success: true, member: data as GroupMember };
  } catch (error) {
    logger.error('Exception adding member', error, 'Groups');
    return { success: false, error: 'Failed to add member' };
  }
}

/**
 * Update member role/permissions
 */
export async function updateMember(
  groupId: string,
  memberId: string,
  input: UpdateMemberInput,
  client?: AnySupabaseClient
): Promise<GroupMemberResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permissions
    const permResult = await canPerformAction(userId, groupId, 'manage_members', sb);
    if (!permResult.allowed) {
      return { success: false, error: permResult.reason || 'Insufficient permissions' };
    }

    // Build update payload
    const payload: Record<string, unknown> = {};

    if (input.role !== undefined) {
      payload.role = input.role;
    }
    if (input.permission_overrides !== undefined) {
      payload.permission_overrides = input.permission_overrides;
    }

    const { data, error } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .update(payload)
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update member', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true, member: data as GroupMember };
  } catch (error) {
    logger.error('Exception updating member', error, 'Groups');
    return { success: false, error: 'Failed to update member' };
  }
}

/**
 * Remove a member from a group
 */
export async function removeMember(
  groupId: string,
  memberId: string,
  client?: AnySupabaseClient
): Promise<ServiceResult> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permissions
    const permResult = await canPerformAction(userId, groupId, 'remove_members', sb);
    if (!permResult.allowed) {
      return { success: false, error: permResult.reason || 'Insufficient permissions' };
    }

    // Can't remove founder
    const memberRole = await getUserRole(groupId, memberId, sb);
    if (memberRole === STATUS.GROUP_MEMBERS.FOUNDER) {
      return { success: false, error: 'Cannot remove the group founder' };
    }

    const { error } = await sb
      .from(DATABASE_TABLES.GROUP_MEMBERS)
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId);

    if (error) {
      logger.error('Failed to remove member', error, 'Groups');
      return { success: false, error: error.message };
    }

    // Log activity
    await logGroupActivity(groupId, userId, 'member_removed', 'Removed a member', undefined, sb);

    return { success: true };
  } catch (error) {
    logger.error('Exception removing member', error, 'Groups');
    return { success: false, error: 'Failed to remove member' };
  }
}
