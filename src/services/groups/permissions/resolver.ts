/**
 * Permission Resolver for Groups
 *
 * Uses the governance preset configs to resolve permissions.
 * Supports hybrid model: roles provide defaults, with optional per-member overrides.
 *
 * Created: 2025-12-29
 */

import {
  GOVERNANCE_PRESETS,
  type GovernancePreset,
  type GroupRole,
  type ActionPermission,
  type RolePermissions,
} from '@/config/governance-presets';
import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '../db-helpers';

/**
 * Result of a permission check
 */
interface PermissionResult {
  allowed: boolean;
  requiresVote: boolean;
  reason?: string;
}

/**
 * Group data needed for permission resolution
 */
interface GroupInfo {
  governance_preset: GovernancePreset;
  voting_threshold?: number | null;
}

/**
 * Member data needed for permission resolution
 */
interface MemberInfo {
  role: GroupRole;
  permission_overrides?: Partial<Record<string, ActionPermission>> | null;
}

/**
 * Check if a user can perform an action on/in a group
 *
 * @param userId - The user attempting the action
 * @param groupId - The group ID (null = user acting as self = always allowed)
 * @param action - The action to check (e.g., 'manage_settings', 'spend_funds')
 * @returns PermissionResult with allowed, requiresVote, and reason
 */
export async function canPerformAction(
  userId: string,
  groupId: string | null,
  action: keyof RolePermissions,
  client?: AnySupabaseClient
): Promise<PermissionResult> {
  // No group = user acting as self = always allowed. Deliberately `=== null`,
  // not falsy: this is the one permissive branch in the whole permission layer,
  // and `!groupId` also caught '' and undefined. Three callers take the id from
  // a request body (mutations/proposals.ts, mutations/invitations.ts ×2), so a
  // body carrying `group_id: ""` was an unconditional allow for any action.
  if (groupId === null) {
    return { allowed: true, requiresVote: false };
  }

  if (!userId) {
    return { allowed: false, requiresVote: false, reason: 'Not authenticated' };
  }

  if (!groupId) {
    return { allowed: false, requiresVote: false, reason: 'Missing group' };
  }

  try {
    const sb = client || supabase;
    // Get group from groups table

    const { data: group, error: _groupError } = await fromTable(sb, DATABASE_TABLES.GROUPS)
      .select('governance_preset, voting_threshold')
      .eq('id', groupId)
      .maybeSingle();

    // Get group info from groups table only
    let groupInfo: GroupInfo | null = null;
    let memberInfo: MemberInfo | null = null;

    if (group) {
      groupInfo = {
        governance_preset: group.governance_preset as GovernancePreset,
        voting_threshold: group.voting_threshold,
      };

      // Get membership from group_members

      const { data: member } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
        .select('role, permission_overrides')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (member) {
        memberInfo = {
          role: member.role as GroupRole,
          permission_overrides: member.permission_overrides,
        };
      }
    }

    if (!groupInfo) {
      return { allowed: false, requiresVote: false, reason: 'Group not found' };
    }

    if (!memberInfo) {
      return { allowed: false, requiresVote: false, reason: 'Not a member' };
    }

    // Check permission override first
    const override = memberInfo.permission_overrides?.[action] as ActionPermission | undefined;
    if (override) {
      return resolvePermission(override);
    }

    // Fall back to governance preset role defaults
    const preset = GOVERNANCE_PRESETS[groupInfo.governance_preset];
    if (!preset) {
      logger.warn('Unknown governance preset', { preset: groupInfo.governance_preset }, 'Groups');
      return { allowed: false, requiresVote: false, reason: 'Unknown governance preset' };
    }

    const rolePermissions = preset.roles[memberInfo.role];
    if (!rolePermissions) {
      logger.warn('Unknown role', { role: memberInfo.role }, 'Groups');
      return { allowed: false, requiresVote: false, reason: 'Unknown role' };
    }

    const permission = rolePermissions[action] ?? 'deny';
    return resolvePermission(permission);
  } catch (error) {
    logger.error('Error checking permission', error, 'Groups');
    return { allowed: false, requiresVote: false, reason: 'Error checking permission' };
  }
}

/**
 * Resolve an ActionPermission to a PermissionResult
 */
export function resolvePermission(permission: ActionPermission): PermissionResult {
  switch (permission) {
    case 'allow':
      return { allowed: true, requiresVote: false };
    case 'vote_required':
      return { allowed: true, requiresVote: true };
    case 'deny':
    default:
      return { allowed: false, requiresVote: false };
  }
}

/**
 * Check multiple actions at once
 *
 * @param userId - The user attempting the actions
 * @param groupId - The group ID
 * @param actions - Array of actions to check
 * @returns Map of action to PermissionResult
 */
export async function canPerformActions(
  userId: string,
  groupId: string | null,
  actions: (keyof RolePermissions)[],
  client?: AnySupabaseClient
): Promise<Map<keyof RolePermissions, PermissionResult>> {
  const results = new Map<keyof RolePermissions, PermissionResult>();

  // If no group, all actions are allowed
  if (!groupId) {
    for (const action of actions) {
      results.set(action, { allowed: true, requiresVote: false });
    }
    return results;
  }

  // Check each action
  for (const action of actions) {
    const result = await canPerformAction(userId, groupId, action, client);
    results.set(action, result);
  }

  return results;
}

/**
 * Get all permissions for a user in a group based on their role and governance preset
 */
export async function getMemberPermissions(
  userId: string,
  groupId: string,
  client?: AnySupabaseClient
): Promise<Record<keyof RolePermissions, PermissionResult> | null> {
  const actions: (keyof RolePermissions)[] = [
    'manage_settings',
    'manage_members',
    'invite_members',
    'remove_members',
    'spend_funds',
    'create_project',
    'create_proposal',
    'vote',
    'delete_group',
  ];

  const results = await canPerformActions(userId, groupId, actions, client);

  // Check if user is a member at all
  const anyAllowed = Array.from(results.values()).some(r => r.allowed);
  if (!anyAllowed) {
    // Check if all denied due to not being a member
    const firstResult = results.values().next().value;
    if (firstResult?.reason === 'Not a member') {
      return null;
    }
  }

  return Object.fromEntries(results) as Record<keyof RolePermissions, PermissionResult>;
}

// Re-export types for convenience
export type { ActionPermission, RolePermissions, GovernancePreset, GroupRole };
