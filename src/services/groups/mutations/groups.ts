/**
 * Groups Mutation Functions
 *
 * Handles all database mutations for group operations.
 * Uses only the new groups table.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-12-29
 * Last Modified Summary: Simplified to use only new groups table
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type { Group, CreateGroupInput, UpdateGroupInput } from '@/types/group';
import type { GroupResponse } from '../types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getDefaultsForLabel } from '../constants';
import { getCurrentUserId, ensureUniqueSlug } from '../utils/helpers';
import { slugify } from '@/utils/string';
import { logGroupActivity } from '../utils/activity';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ServiceResult } from '@/types/common';
import { fromTable } from '../db-helpers';

/**
 * Create a new group
 * @param input - Group creation input
 * @param client - Optional Supabase client (for server-side usage). If not provided, uses browser client.
 * @param userId - Optional user ID (for server-side usage). If not provided, attempts to get from client.
 */
export async function createGroup(
  input: CreateGroupInput,
  client?: AnySupabaseClient,
  userId?: string
): Promise<GroupResponse> {
  try {
    const supabaseClient = client || supabase;
    const currentUserId = userId || (await getCurrentUserId(supabaseClient));
    if (!currentUserId) {
      return { success: false, error: 'Authentication required' };
    }

    // Generate slug if not provided
    const slug =
      input.slug || (await ensureUniqueSlug(slugify(input.name) || 'group', undefined, supabaseClient));

    // Get config-based defaults for this label
    const label = input.label || 'circle';
    const labelDefaults = getDefaultsForLabel(label);

    // Build payload with defaults
    const payload = {
      name: input.name,
      slug,
      description: input.description || null,
      label,
      tags: input.tags || [],
      avatar_url: input.avatar_url || null,
      banner_url: input.banner_url || null,
      is_public: input.is_public ?? labelDefaults.is_public,
      visibility: input.visibility || labelDefaults.visibility,
      bitcoin_address: input.bitcoin_address || null,
      lightning_address: input.lightning_address || null,
      governance_preset: input.governance_preset || labelDefaults.governance_preset,
      voting_threshold: input.voting_threshold || null,
      created_by: currentUserId,
    };

    // Insert into groups table

    const { data, error } = await fromTable(supabaseClient, DATABASE_TABLES.GROUPS)
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create group', error, 'Groups');
      return { success: false, error: error.message };
    }

    // The creator's founder membership and the group's `actors` row are both
    // written by the `groups_get_an_identity_and_an_owner` trigger, in the same
    // transaction as the group itself.
    //
    // They used to be written here, as a second statement whose failure was a
    // `logger.warn` — so a failed insert still returned success and left a
    // group with no members. Both DELETE policies require role='founder', so
    // that group could then be deleted by nobody. Three production groups are
    // in exactly that state. A second statement cannot be atomic with the
    // first; a trigger is.

    // Enable suggested features for this label
    if (labelDefaults.suggestedFeatures && labelDefaults.suggestedFeatures.length > 0) {
      const featureInserts = labelDefaults.suggestedFeatures.map((feature: string) => ({
        group_id: data.id,
        feature_key: feature,
        enabled: true,
        enabled_by: currentUserId,
      }));

      await fromTable(supabaseClient, DATABASE_TABLES.GROUP_FEATURES).insert(featureInserts);
    }

    // Log activity
    await logGroupActivity(
      data.id,
      currentUserId,
      'created_group',
      'Created the group',
      undefined,
      supabaseClient
    );

    logger.info('Group created', { groupId: data.id, label }, 'Groups');

    return { success: true, group: data as Group };
  } catch (error) {
    logger.error('Exception creating group', error, 'Groups');
    return { success: false, error: 'Failed to create group' };
  }
}

/**
 * Update an existing group
 */
export async function updateGroup(
  groupId: string,
  input: UpdateGroupInput,
  client?: AnySupabaseClient
): Promise<GroupResponse> {
  try {
    const supabaseClient = client || supabase;
    const userId = await getCurrentUserId(supabaseClient);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permissions using the new resolver
    const { canPerformAction } = await import('../permissions/resolver');
    const permResult = await canPerformAction(userId, groupId, 'manage_settings', supabaseClient);
    if (!permResult.allowed) {
      return { success: false, error: permResult.reason || 'Insufficient permissions' };
    }

    // Build update payload
    const payload: Record<string, unknown> = {};

    if (input.name !== undefined) {
      payload.name = input.name;
    }
    if (input.slug !== undefined) {
      payload.slug = await ensureUniqueSlug(input.slug, groupId, supabaseClient);
    }
    if (input.description !== undefined) {
      payload.description = input.description;
    }
    if (input.label !== undefined) {
      payload.label = input.label;
    }
    if (input.tags !== undefined) {
      payload.tags = input.tags;
    }
    if (input.avatar_url !== undefined) {
      payload.avatar_url = input.avatar_url;
    }
    if (input.banner_url !== undefined) {
      payload.banner_url = input.banner_url;
    }
    if (input.is_public !== undefined) {
      payload.is_public = input.is_public;
    }
    if (input.visibility !== undefined) {
      payload.visibility = input.visibility;
    }
    if (input.bitcoin_address !== undefined) {
      payload.bitcoin_address = input.bitcoin_address;
    }
    if (input.lightning_address !== undefined) {
      payload.lightning_address = input.lightning_address;
    }
    if (input.governance_preset !== undefined) {
      payload.governance_preset = input.governance_preset;
    }
    if (input.voting_threshold !== undefined) {
      payload.voting_threshold = input.voting_threshold;
    }

    const { data, error } = await fromTable(supabaseClient, DATABASE_TABLES.GROUPS)
      .update(payload)
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update group', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true, group: data as Group };
  } catch (error) {
    logger.error('Exception updating group', error, 'Groups');
    return { success: false, error: 'Failed to update group' };
  }
}

/**
 * Delete a group (only founders can delete)
 */
export async function deleteGroup(
  groupId: string,
  client?: AnySupabaseClient
): Promise<ServiceResult> {
  try {
    const supabaseClient = client || supabase;
    const userId = await getCurrentUserId(supabaseClient);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permissions using new resolver
    const { canPerformAction } = await import('../permissions/resolver');
    const permResult = await canPerformAction(userId, groupId, 'delete_group', supabaseClient);
    if (!permResult.allowed) {
      return {
        success: false,
        error: permResult.reason || 'Only group founders can delete groups',
      };
    }

    const { error } = await fromTable(supabaseClient, DATABASE_TABLES.GROUPS)
      .delete()
      .eq('id', groupId);

    if (error) {
      logger.error('Failed to delete group', error, 'Groups');
      return { success: false, error: error.message };
    }

    logger.info('Group deleted', { groupId }, 'Groups');
    return { success: true };
  } catch (error) {
    logger.error('Exception deleting group', error, 'Groups');
    return { success: false, error: 'Failed to delete group' };
  }
}
