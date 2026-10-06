/**
 * Groups Query Functions
 *
 * Handles all database queries for group read operations.
 * Unified for both circles and organizations.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created unified group queries
 */

import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { Group, GroupsQuery, GroupsListResponse, GroupResponse } from '../types';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { getCurrentUserId, getUserGroupIds } from '../utils/helpers';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '../db-helpers';
import type { FilterChain } from '@/lib/supabase/untyped';

// Legacy query fields → live `groups` schema. The table has no `type`,
// `category`, `governance_model`, or `member_count` columns; those are legacy
// API params that map onto the real columns (label, tags, governance_preset).
// member_count has no equivalent yet, so it is ignored rather than 400-ing the
// whole query. Kept in ONE place and shared by every groups list query.
const TYPE_TO_LABEL: Record<string, string> = {
  circle: 'circle',
  community: 'network_state',
  collective: 'cooperative',
  dao: 'dao',
  company: 'company',
  nonprofit: 'nonprofit',
  foundation: 'nonprofit',
  guild: 'guild',
};

const GOVERNANCE_MODEL_TO_PRESET: Record<string, string> = {
  consensus: 'consensus',
  flat: 'consensus',
  democratic: 'democratic',
  hierarchical: 'hierarchical',
  liquid_democracy: 'democratic',
  quadratic_voting: 'democratic',
  stake_weighted: 'democratic',
  reputation_based: 'democratic',
};

// Columns that actually exist on `groups` and are safe to ORDER BY. `member_count`
// is in the legacy sort union but has no column, so it falls back to created_at.
const SORTABLE_GROUP_COLUMNS = new Set(['created_at', 'name']);

function safeGroupSort(sortBy?: string): string {
  return sortBy && SORTABLE_GROUP_COLUMNS.has(sortBy) ? sortBy : 'created_at';
}

/** The PostgREST filter methods {@link applyGroupFilters} chains; keeps the caller's builder type. */
type GroupFilterChain<B> = Pick<FilterChain<B>, 'eq' | 'not'> & {
  contains(column: string, value: unknown): B;
  is(column: string, value: null): B;
};

/**
 * Apply GroupsQuery filters onto a `groups` query, mapping legacy fields onto the
 * live schema. Shared by getUserGroups / getAvailableGroups / searchGroups so the
 * mapping lives in exactly one place (was triplicated and drifting).
 */
function applyGroupFilters<B extends GroupFilterChain<B>>(dbQuery: B, q?: GroupsQuery): B {
  if (!q) {
    return dbQuery;
  }

  const label = q.label ?? (q.type ? (TYPE_TO_LABEL[q.type] ?? q.type) : undefined);
  if (label) {
    dbQuery = dbQuery.eq('label', label);
  }

  const preset =
    q.governance_preset ??
    (q.governance_model
      ? (GOVERNANCE_MODEL_TO_PRESET[q.governance_model] ?? q.governance_model)
      : undefined);
  if (preset) {
    dbQuery = dbQuery.eq('governance_preset', preset);
  }

  if (q.category) {
    dbQuery = dbQuery.contains('tags', [q.category]); // category is folded into tags
  }
  if (q.visibility) {
    dbQuery = dbQuery.eq('visibility', q.visibility);
  }
  if (q.is_public !== undefined) {
    dbQuery = dbQuery.eq('is_public', q.is_public);
  }
  if (q.has_treasury !== undefined) {
    dbQuery = q.has_treasury
      ? dbQuery.not('bitcoin_address', 'is', null)
      : dbQuery.is('bitcoin_address', null);
  }

  return dbQuery;
}

/**
 * Get a specific group by slug
 * Convenience wrapper around getGroup
 */
export async function getGroupBySlug(
  slug: string,
  client?: AnySupabaseClient
): Promise<GroupResponse> {
  return getGroup(slug, true, client);
}

/**
 * Get a specific group by ID or slug
 */
export async function getGroup(
  identifier: string,
  bySlug: boolean = false,
  client?: AnySupabaseClient
): Promise<GroupResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);

    let query = fromTable(sb, DATABASE_TABLES.GROUPS).select('*');

    if (bySlug) {
      query = query.eq('slug', identifier);
    } else {
      query = query.eq('id', identifier);
    }

    // If user is not authenticated, only show public groups
    if (!userId) {
      query = query.eq('is_public', true);
    } else {
      // Show public groups or groups the user is a member of
      const userGroupIds = await getUserGroupIds(userId, sb);
      if (userGroupIds.length > 0) {
        query = query.or(`is_public.eq.true,id.in.(${userGroupIds.join(',')})`);
      } else {
        query = query.eq('is_public', true);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error('Failed to get group', error, 'Groups');
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Group not found' };
    }

    return { success: true, group: data as Group };
  } catch (error) {
    logger.error('Exception getting group', error, 'Groups');
    return { success: false, error: 'Failed to get group' };
  }
}

/**
 * Get groups for current user
 */
export async function getUserGroups(
  query?: GroupsQuery,
  pagination?: { page?: number; pageSize?: number },
  client?: AnySupabaseClient
): Promise<GroupsListResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Get user's group IDs from group_members

    const { data: memberships } = await fromTable(sb, DATABASE_TABLES.GROUP_MEMBERS)
      .select('group_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      return { success: true, groups: [], total: 0 };
    }

    const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

    let dbQuery = fromTable(sb, DATABASE_TABLES.GROUPS)
      .select('*', { count: 'exact' })
      .in('id', groupIds);

    // Apply filters (legacy fields mapped to live schema)
    dbQuery = applyGroupFilters(dbQuery, query);

    // Apply sorting
    const sortBy = safeGroupSort(query?.sort_by);
    const sortOrder = query?.sort_order || 'desc';
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const pageSize = Math.min(pagination?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const page = pagination?.page || 1;
    const offset = (page - 1) * pageSize;

    dbQuery = dbQuery.range(offset, offset + pageSize - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error('Failed to get user groups', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true, groups: (data || []) as Group[], total: count || 0 };
  } catch (error) {
    logger.error('Exception getting user groups', error, 'Groups');
    return { success: false, error: 'Failed to get groups' };
  }
}

/**
 * Get available groups for discovery (public groups)
 */
export async function getAvailableGroups(
  query?: GroupsQuery,
  pagination?: { page?: number; pageSize?: number },
  client?: AnySupabaseClient
): Promise<GroupsListResponse> {
  try {
    const sb = client || supabase;
    const _userId = await getCurrentUserId(sb);

    let dbQuery = fromTable(sb, DATABASE_TABLES.GROUPS)
      .select('*', { count: 'exact' })
      .eq('is_public', true);

    // Apply filters (legacy fields mapped to live schema)
    dbQuery = applyGroupFilters(dbQuery, query);

    // Apply sorting
    const sortBy = safeGroupSort(query?.sort_by);
    const sortOrder = query?.sort_order || 'desc';
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const pageSize = Math.min(pagination?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const page = pagination?.page || 1;
    const offset = (page - 1) * pageSize;

    dbQuery = dbQuery.range(offset, offset + pageSize - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error('Failed to get available groups', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true, groups: (data || []) as Group[], total: count || 0 };
  } catch (error) {
    logger.error('Exception getting available groups', error, 'Groups');
    return { success: false, error: 'Failed to get available groups' };
  }
}

/**
 * Search groups by query string
 */
export async function searchGroups(
  searchQuery: string,
  filters?: GroupsQuery,
  pagination?: { page?: number; pageSize?: number },
  client?: AnySupabaseClient
): Promise<GroupsListResponse> {
  try {
    const sb = client || supabase;
    const _userId = await getCurrentUserId(sb);

    const escapedSearchQuery = searchQuery.replace(/[%_]/g, '\\$&');
    let dbQuery = fromTable(sb, DATABASE_TABLES.GROUPS)
      .select('*', { count: 'exact' })
      .or(`name.ilike.%${escapedSearchQuery}%,description.ilike.%${escapedSearchQuery}%`);

    // Apply filters (legacy fields mapped to live schema)
    dbQuery = applyGroupFilters(dbQuery, filters);

    // Apply sorting
    const sortBy = safeGroupSort(filters?.sort_by);
    const sortOrder = filters?.sort_order || 'desc';
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const pageSize = Math.min(pagination?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const page = pagination?.page || 1;
    const offset = (page - 1) * pageSize;

    dbQuery = dbQuery.range(offset, offset + pageSize - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error('Failed to search groups', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true, groups: (data || []) as Group[], total: count || 0 };
  } catch (error) {
    logger.error('Exception searching groups', error, 'Groups');
    return { success: false, error: 'Failed to search groups' };
  }
}
