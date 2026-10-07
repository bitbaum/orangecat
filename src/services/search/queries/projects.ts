/**
 * Project / Funding Page Search Queries
 *
 * Handles database queries for searching projects (funding pages),
 * including full-text search, geo/radius search, and ILIKE fallback.
 */

import supabase from '@/lib/supabase/browser';
import type { FilterChain } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import { PROJECT_STATUS, PUBLIC_SEARCH_STATUSES } from '@/config/project-statuses';
import { getTableName } from '@/config/entity-registry';
import {
  enrichProjectsWithSettledFunding,
  type SettledProjectFunding,
} from '@/services/wallets/project-funding';
import type { SearchFundingPage, SearchFilters, RawSearchProject } from '../types';
import { buildProfileMap } from './helpers';
import { ilikeAny } from '@/lib/db/likePattern';

/**
 * Search projects with filters
 */
export async function searchFundingPages(
  query?: string,
  filters?: SearchFilters,
  limit: number = 20,
  offset: number = 0
): Promise<SearchFundingPage[]> {
  // Only select necessary columns to reduce payload
  let projectQuery = supabase.from(getTableName('project')).select(
    `
      id, user_id, title, description, bitcoin_address,
      created_at, updated_at, category, status, goal_amount, currency, raised_amount,
      cover_image_url
    `
  );

  // Priority 1: If radius is specified, use PostGIS RPC (handles both query and radius)
  if (filters?.radius_km && filters.lat !== undefined && filters.lng !== undefined) {
    try {
      const { data, error } = await supabase.rpc('search_projects_nearby', {
        p_lat: filters.lat,
        p_lng: filters.lng,
        p_radius_km: filters.radius_km,
        // NULL means "no text filter" in SQL; the generated Args type omits that it is nullable.
        p_query: (query || null) as string | undefined,
        p_limit: limit,
        p_offset: offset,
      });

      if (!error && data) {
        let results = data as RawSearchProject[];
        results = applyProjectFilters(results, filters);
        return finishProjects(results, filters);
      }
    } catch (rpcError) {
      logger.warn('PostGIS RPC not available, using application filtering', rpcError, 'Search');
    }
  }

  // Priority 2: If query is specified (and no radius), use full-text search RPC
  if (query) {
    try {
      const { data, error } = await supabase.rpc('search_projects_fts', {
        p_query: query,
        p_limit: limit,
        p_offset: offset,
      });

      if (!error && data) {
        let results = data as RawSearchProject[];
        if (filters) {
          results = applyProjectFilters(results, filters);
        } else {
          // Default: Show only public search statuses
          results = results.filter(p =>
            PUBLIC_SEARCH_STATUSES.includes(p.status as (typeof PUBLIC_SEARCH_STATUSES)[number])
          );
        }

        return finishProjects(results, filters);
      }
    } catch (rpcError) {
      logger.warn('Full-text search RPC not available, using ILIKE', rpcError, 'Search');
    }
  }

  // Fallback: Use standard Supabase query builder with ILIKE
  if (query) {
    projectQuery = projectQuery.or(ilikeAny(['title', 'description'], query));
  }

  // Apply filters
  if (filters) {
    projectQuery = applyProjectQueryFilters(projectQuery, filters);
  } else {
    // Default status filter when no filters provided
    projectQuery = projectQuery.in('status', PUBLIC_SEARCH_STATUSES as string[]);
  }

  // Use index-friendly ordering
  const { data: rawProjects, error } = await projectQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }
  if (!rawProjects || rawProjects.length === 0) {
    return [];
  }

  return finishProjects(rawProjects as RawSearchProject[], filters);
}

/**
 * Shared tail for every search path: enrich with settled-ledger funding
 * (raised_amount is a dead DB column — the honest figure comes from the batch
 * funding-stats RPC), apply funding-range filters against the REAL totals,
 * then attach creator profiles and shape the result.
 */
async function finishProjects(
  results: RawSearchProject[],
  filters?: SearchFilters
): Promise<SearchFundingPage[]> {
  let enriched = await enrichProjectsWithSettledFunding(supabase, results);

  // Funding filters must run AFTER enrichment — the DB column is never written,
  // so filtering on it at the SQL layer matched nothing (or everything).
  if (filters?.minFunding !== undefined) {
    enriched = enriched.filter(p => p.raised_amount >= filters.minFunding!);
  }
  if (filters?.maxFunding !== undefined) {
    enriched = enriched.filter(p => p.raised_amount <= filters.maxFunding!);
  }

  const userIds = [...new Set(enriched.map(p => p.user_id))];
  const profileMap = await buildProfileMap(userIds);

  return enriched.map(project => transformProject(project, profileMap));
}

/**
 * Apply in-memory filters to RPC project results.
 */
function applyProjectFilters(
  results: RawSearchProject[],
  filters: SearchFilters
): RawSearchProject[] {
  let filtered = results;

  if (filters.statuses && filters.statuses.length > 0) {
    filtered = filtered.filter(p =>
      filters.statuses!.includes(p.status as 'active' | 'paused' | 'completed' | 'cancelled')
    );
  } else if (filters.isActive !== undefined) {
    if (filters.isActive) {
      filtered = filtered.filter(p => p.status === PROJECT_STATUS.ACTIVE);
    } else {
      filtered = filtered.filter(p => p.status !== PROJECT_STATUS.ACTIVE);
    }
  } else {
    // Default: Show active and paused projects
    filtered = filtered.filter(p =>
      ([PROJECT_STATUS.ACTIVE, PROJECT_STATUS.PAUSED] as string[]).includes(p.status)
    );
  }

  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(p => filters.categories!.includes(p.category || ''));
  }
  if (filters.hasGoal) {
    filtered = filtered.filter(p => p.goal_amount !== null);
  }
  // minFunding/maxFunding are applied post-enrichment in finishProjects — the
  // raw raised_amount column is dead and would filter dishonestly here.
  if (filters.dateRange) {
    filtered = filtered.filter(
      p => p.created_at >= filters.dateRange!.start && p.created_at <= filters.dateRange!.end
    );
  }

  return filtered;
}

/**
 * Apply Supabase query-builder filters for the fallback path.
 */
function applyProjectQueryFilters<B extends FilterChain<B>>(
  projectQuery: B,
  filters: SearchFilters
) {
  // Status filtering
  if (filters.statuses && filters.statuses.length > 0) {
    projectQuery = projectQuery.in('status', filters.statuses);
  } else if (filters.isActive !== undefined) {
    if (filters.isActive) {
      projectQuery = projectQuery.eq('status', PROJECT_STATUS.ACTIVE);
    } else {
      projectQuery = projectQuery.neq('status', PROJECT_STATUS.ACTIVE);
    }
  } else {
    projectQuery = projectQuery.in('status', PUBLIC_SEARCH_STATUSES as string[]);
  }

  if (filters.categories && filters.categories.length > 0) {
    projectQuery = projectQuery.in('category', filters.categories);
  }

  if (filters.hasGoal) {
    projectQuery = projectQuery.not('goal_amount', 'is', null);
  }

  // minFunding/maxFunding are applied post-enrichment in finishProjects — the
  // raised_amount column is dead, so a SQL-level gte/lte lies.

  if (filters.dateRange) {
    projectQuery = projectQuery
      .gte('created_at', filters.dateRange.start)
      .lte('created_at', filters.dateRange.end);
  }

  return projectQuery;
}

/**
 * Transform a raw project row into a SearchFundingPage.
 */
function transformProject(
  project: RawSearchProject & SettledProjectFunding,
  profileMap: Map<
    string,
    { id: string; username: string | null; name: string | null; avatar_url: string | null }
  >
): SearchFundingPage {
  const coverImageUrl = project.cover_image_url;
  // Destructure out cover_image_url since SearchFundingPage doesn't have that field
  const { cover_image_url: _coverImg, ...rest } = project;
  return {
    ...rest,
    banner_url: coverImageUrl,
    featured_image_url: coverImageUrl,
    profiles: profileMap.get(project.user_id),
  };
}
