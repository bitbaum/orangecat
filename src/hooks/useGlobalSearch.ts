import { useCallback } from 'react';
import { useSearchAsYouType } from '@bitbaum/searchkit/react';
import { API_ROUTES } from '@/config/api-routes';
import type { FindResult } from '@/services/search/find';

interface UseGlobalSearchResult {
  results: FindResult['hits'];
  /** How many public rows match in all — the palette shows a handful. */
  total: number;
  loading: boolean;
}

const EMPTY: FindResult['hits'] = [];

/**
 * Search as you type for the ⌘K palette, through /api/search — the same
 * typo-tolerant, ranked search Discover runs. Each keystroke cancels the
 * request before it, and a late answer to an older query is dropped
 * (@bitbaum/searchkit/react).
 */
export function useGlobalSearch(
  query: string,
  enabled: boolean = true,
  limit: number = 12
): UseGlobalSearchResult {
  const run = useCallback(
    async (q: string, signal: AbortSignal): Promise<FindResult> => {
      const params = new URLSearchParams({ q, limit: String(limit), per_type: '4' });
      const res = await fetch(`${API_ROUTES.SEARCH.FIND}?${params}`, { signal });
      if (!res.ok) {
        return { hits: [], total: 0, suggestion: null };
      }
      const body = (await res.json()) as { data?: FindResult };
      return body.data ?? { hits: [], total: 0, suggestion: null };
    },
    [limit]
  );
  const { results, loading } = useSearchAsYouType(query, run, { enabled, minLength: 2 });
  return { results: results?.hits ?? EMPTY, total: results?.total ?? 0, loading };
}
