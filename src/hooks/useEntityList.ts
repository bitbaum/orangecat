import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/utils/logger';

/**
 * useEntityList - Reusable hook for fetching and managing entity lists
 *
 * Features:
 * - Automatic pagination
 * - Loading and error states
 * - Type-safe
 * - DRY principle - single source of truth for data fetching
 *
 * Created: 2025-01-27
 * Last Modified: 2025-01-27
 * Last Modified Summary: Initial creation of reusable entity list hook
 */

interface UseEntityListOptions<T = Record<string, unknown>> {
  apiEndpoint: string;
  userId?: string;
  limit?: number;
  enabled?: boolean;
  queryParams?: Record<string, string | number>;
  transformResponse?: (data: any) => { items: T[]; total: number };
}

interface UseEntityListResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
}

export function useEntityList<T extends { id: string }>(
  options: UseEntityListOptions<T>
): UseEntityListResult<T> {
  const {
    apiEndpoint,
    userId,
    limit = 12,
    enabled = true,
    queryParams = {},
    transformResponse,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const offset = useMemo(() => (page - 1) * limit, [page, limit]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, limit))),
    [total, limit]
  );

  // Keep a stable ref to the latest queryParams/transformResponse to avoid
  // re-triggering the effect when callers pass new object literals each render.
  const queryParamsRef = useRef(queryParams);
  const transformResponseRef = useRef(transformResponse);
  queryParamsRef.current = queryParams;
  transformResponseRef.current = transformResponse;

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Build query string
        const params = new URLSearchParams({
          ...(userId && { user_id: userId }),
          limit: limit.toString(),
          offset: offset.toString(),
          ...Object.fromEntries(
            Object.entries(queryParamsRef.current).map(([key, value]) => [key, String(value)])
          ),
        });

        const response = await fetch(`${apiEndpoint}?${params.toString()}`, {
          cache: 'no-store',
          signal,
        });
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests — wait a moment and try again.');
          }
          throw new Error(`Failed to load items: ${response.statusText}`);
        }

        const data = await response.json();

        // Use custom transformer if provided, otherwise use default structure
        if (transformResponseRef.current) {
          const transformed = transformResponseRef.current(data);
          setItems(transformed.items);
          setTotal(transformed.total);
        } else {
          // `data.data` MUST be the array of rows. A route that nests its own
          // envelope (`apiSuccess({ data, count })`) puts an OBJECT here, and
          // the old code assigned it to `items` verbatim — so the feed
          // rendered nothing and `total` read 0, with no error anywhere.
          // /api/projects/favorites did exactly that and the Favorites tab was
          // dead; same class as the follow-list envelope behind #902.
          //
          // Recover if the rows are one level deeper, but say so loudly:
          // silence is what let both of these live in production.
          const payload = data.data;
          if (Array.isArray(payload)) {
            setItems(payload);
          } else if (Array.isArray(payload?.data)) {
            logger.error(
              'Entity feed returned a nested envelope; reading one level deeper',
              { apiEndpoint, keys: Object.keys(payload) },
              'useEntityList'
            );
            setItems(payload.data);
          } else {
            if (payload !== null && payload !== undefined) {
              logger.error(
                'Entity feed payload is not an array',
                { apiEndpoint, received: typeof payload },
                'useEntityList'
              );
            }
            setItems([]);
          }
          setTotal(data.metadata?.total ?? payload?.count ?? 0);
        }
      } catch (err) {
        // Ignore abort errors — they're intentional (component unmounted or deps changed)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load items');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [enabled, userId, limit, offset, apiEndpoint]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadItems(controller.signal);
    return () => controller.abort();
  }, [loadItems]);

  // Memoize items to prevent unnecessary re-renders
  const memoizedItems = useMemo(() => items, [items]);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    await loadItems(controller.signal);
  }, [loadItems]);

  return {
    items: memoizedItems,
    loading,
    error,
    page,
    total,
    totalPages,
    setPage,
    refresh,
  };
}
