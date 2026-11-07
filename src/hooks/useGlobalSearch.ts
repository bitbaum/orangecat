import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/config/api-routes';
import type { FindResult } from '@/services/search/find';
const EMPTY: FindResult['hits'] = [];

/** Query owns cancellation, stale-query isolation and explicit retry. Searchkit
 * still supplies the shared server ranking, typo corrections and highlights. */
export function useGlobalSearch(query: string, enabled = true, limit = 12) {
  const typed = query.trim();
  const active = enabled && typed.length >= 2;
  const search = useQuery({
    queryKey: ['public-search', typed, limit],
    enabled: active,
    queryFn: async ({ signal }): Promise<FindResult> => {
      // A short pause coalesces typing; obsolete queries never reach the server.
      await new Promise(resolve => setTimeout(resolve, 100));
      signal.throwIfAborted();
      const params = new URLSearchParams({ q: typed, limit: String(limit), per_type: '4' });
      const response = await fetch(`${API_ROUTES.SEARCH.FIND}?${params}`, { signal });
      if (!response.ok) {
        throw new Error('Public search unavailable');
      }
      const body = (await response.json()) as { data?: FindResult };
      if (!Array.isArray(body.data?.hits) || typeof body.data?.total !== 'number') {
        throw new Error('Incomplete search response');
      }
      return body.data;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const error =
    active && search.isError && !search.isFetching ? 'Public search could not be loaded.' : null;
  return {
    results: active && !error ? (search.data?.hits ?? EMPTY) : EMPTY,
    total: active && !error ? (search.data?.total ?? 0) : 0,
    loading: active && search.isFetching,
    error,
    retry: () => {
      if (active) {
        void search.refetch();
      }
    },
  };
}
