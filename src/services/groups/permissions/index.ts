/**
 * Groups Service Permissions
 *
 * ONE resolver — `canPerformAction` — and a thin adapter over it.
 *
 * There were three implementations of "may this person do this here", with
 * three argument orders: `canPerformAction(userId, groupId, …)`,
 * `checkGroupPermission(groupId, userId, …)` and `getGroupPermissions`. All
 * three read the same two tables and the same presets, and all three disagreed
 * about the third permission state: for it the first granted, the second fell
 * through to the preset, and the third denied. Both ids are plain strings, so a
 * swapped call compiled silently.
 *
 * `checkGroupPermission` now translates its own vocabulary into the resolver's
 * and asks it. It keeps only what the resolver cannot express: `canView` and
 * `canJoin`, which are about visibility rather than authority and have no entry
 * in RolePermissions. `getGroupPermissions` is gone — nothing called it.
 */

// Export the config-based resolver (primary permission system)
export { canPerformAction, resolvePermission } from './resolver';

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '../db-helpers';
import { canPerformAction } from './resolver';
import type { RolePermissions } from '@/config/governance-presets';

// Permission keys that map to governance preset actions
export type GroupPermissionKey =
  | 'canView'
  | 'canJoin'
  | 'canInvite'
  | 'canManageMembers'
  | 'canManageWallets'
  | 'canCreateProjects'
  | 'canManageSettings'
  | 'canDelete'
  | 'canCreateProposals'
  | 'canVote';

/**
 * Maps this module's vocabulary onto the resolver's.
 *
 * `canView` and `canJoin` are deliberately absent: they are visibility, not
 * authority, and have no cell in RolePermissions. They used to sit here mapped
 * to 'view' and 'join' — two strings no preset defines — which is why the
 * lookup needed a cast to compile. Excluding them types the map against
 * RolePermissions instead, so a typo in an action name is a build error.
 */
const PERMISSION_TO_ACTION: Record<
  Exclude<GroupPermissionKey, 'canView' | 'canJoin'>,
  keyof RolePermissions
> = {
  canInvite: 'invite_members',
  canManageMembers: 'manage_members',
  canManageWallets: 'spend_funds',
  canCreateProjects: 'create_project',
  canManageSettings: 'manage_settings',
  canDelete: 'delete_group',
  canCreateProposals: 'create_proposal',
  canVote: 'vote',
};

/**
 * Does this person have this permission in this group?
 *
 * Note the argument order is (groupId, userId) while the resolver takes
 * (userId, groupId). Both are plain strings, so nothing catches a swap — the
 * order is kept because the existing call sites pass it this way.
 */
export async function checkGroupPermission(
  groupId: string,
  userId: string,
  permission: GroupPermissionKey,
  client?: AnySupabaseClient
): Promise<boolean> {
  if (!userId || !groupId) {
    return false;
  }

  // Visibility, not authority: neither `view` nor `join` exists in
  // RolePermissions, so no preset can express them and the resolver cannot be
  // asked. A public group is viewable and joinable by anyone; a member can
  // always view their own group.
  if (permission === 'canView' || permission === 'canJoin') {
    try {
      const sb = client || supabase;
      const { data: group } = await fromTable(sb, DATABASE_TABLES.GROUPS)
        .select('is_public')
        .eq('id', groupId)
        .maybeSingle();
      if (!group) {
        return false;
      }

      // Anyone may read a public group, so this needs no membership lookup.
      if (permission === 'canView' && group.is_public) {
        return true;
      }

      const { data: membership } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      // You cannot join what you are already in. The old code reached this
      // answer by accident rather than on purpose: it looked `canJoin` up in
      // RolePermissions under the key 'join', which no preset defines, so the
      // lookup returned undefined and the comparison to 'allow' was false.
      // Same answer, now for a stated reason.
      if (permission === 'canJoin') {
        return group.is_public && !membership;
      }

      // A private group is readable only by its members.
      return !!membership;
    } catch (error) {
      logger.error('Error checking group visibility', error, 'Groups');
      return false;
    }
  }

  const action = PERMISSION_TO_ACTION[permission];
  const result = await canPerformAction(userId, groupId, action, client);
  return result.allowed;
}
