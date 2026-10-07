/**
 * Search Suggestions Queries
 *
 * Type-ahead / autocomplete backed by the `global_search` RPC (typo-tolerant,
 * accent-insensitive, ranked, across every publicly findable entity type). Falls back to a
 * simple ILIKE query on profiles + projects if the RPC is unavailable.
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { PUBLIC_SEARCH_STATUSES } from '@/config/project-statuses';
import { getTableName } from '@/config/entity-registry';
import { ilikeAny } from '@/lib/db/likePattern';

/** A single ranked, navigable search hit from global_search(). */
export interface GlobalSearchHit {
  entity_type: string;
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  rank: number;
  /**
   * The key the public URL uses when it is not the id: the username for a
   * profile, the slug for a group (organisation). Null otherwise.
   */
  path_key: string | null;
}

/**
 * Ranked structured results across profiles and every public entity type —
 * projects, products, services, causes, loans, events, investments, assets,
 * research, wishlists, organisations, circles and companions. Use for richer
 * surfaces like the command palette where each hit links straight to its entity.
 */
export async function getGlobalSearchResults(
  query: string,
  limit: number = 10
): Promise<GlobalSearchHit[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }
  try {
    const { data, error } = await supabase.rpc('global_search', {
      p_query: query,
      p_limit: limit,
    } as never);
    if (error) {
      logger.warn('global_search RPC unavailable', error, 'Search');
      return [];
    }
    return (data as GlobalSearchHit[]) ?? [];
  } catch (error) {
    logger.warn('global_search RPC threw', error, 'Search');
    return [];
  }
}

/**
 * Type-ahead suggestion strings. Backed by global_search (so suggestions are
 * typo-tolerant and span every entity type); falls back to ILIKE on
 * profiles + projects only if the RPC is unavailable.
 */
export async function getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Primary: ranked, typo-tolerant suggestions from global_search.
  const hits = await getGlobalSearchResults(query, limit * 3);
  if (hits.length > 0) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const hit of hits) {
      const title = hit.title?.trim();
      if (title && !seen.has(title.toLowerCase())) {
        seen.add(title.toLowerCase());
        out.push(title);
        if (out.length >= limit) {
          break;
        }
      }
    }
    if (out.length > 0) {
      return out;
    }
  }

  // Fallback: simple ILIKE on profiles + projects.
  try {
    const [profileSuggestions, projectSuggestions] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('username, name')
        .or(ilikeAny(['username', 'name'], query))
        .not('username', 'is', null)
        .limit(limit),
      supabase
        .from(getTableName('project'))
        .select('title, category')
        .or(ilikeAny(['title', 'category'], query))
        .in('status', PUBLIC_SEARCH_STATUSES as string[])
        .limit(limit),
    ]);

    const suggestions: Set<string> = new Set();
    if (!profileSuggestions.error && profileSuggestions.data) {
      (profileSuggestions.data as Array<{ username?: string; name?: string }>).forEach(profile => {
        if (profile.username) {
          suggestions.add(profile.username);
        }
        if (profile.name) {
          suggestions.add(profile.name);
        }
      });
    }
    if (!projectSuggestions.error && projectSuggestions.data) {
      (projectSuggestions.data as Array<{ title?: string; category?: string }>).forEach(project => {
        if (project.title) {
          suggestions.add(project.title);
        }
        if (project.category) {
          suggestions.add(project.category);
        }
      });
    }
    return Array.from(suggestions).slice(0, limit);
  } catch (error) {
    logger.error('Error getting search suggestions', error, 'Search');
    return [];
  }
}
