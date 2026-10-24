import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/api-routes';
import type { Thing } from '@/domain/things/service';
const EMPTY: Thing[] = [];

/** An account switch changes the query immediately; old private names never
 * become another account's search suggestions, even before effects run. */
export function useOwnSearchThings(open: boolean) {
  const { user } = useAuth();
  const ownerId = user?.id;
  const active = open && Boolean(ownerId);
  const query = useQuery({
    queryKey: ['own-search-things', ownerId],
    enabled: active,
    queryFn: async ({ signal }): Promise<Thing[]> => {
      const response = await fetch(API_ROUTES.THINGS, { signal });
      if (!response.ok) {
        throw new Error('Your items could not be loaded');
      }
      const body = (await response.json()) as { data?: { things?: Thing[] } };
      if (!Array.isArray(body.data?.things)) {
        throw new Error('Incomplete items response');
      }
      return body.data.things;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  return {
    things: active && !query.isError ? (query.data ?? EMPTY) : EMPTY,
    loading: active && query.isFetching,
    error: active && query.isError && !query.isFetching ? 'Your items could not be loaded.' : null,
    retry: () => {
      if (active) {
        void query.refetch();
      }
    },
  };
}
