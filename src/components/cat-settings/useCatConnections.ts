/**
 * This user's Cat connections with their status (GET /api/cat/connections).
 * Shared by the connections section and the settings summary, so the page
 * asks once.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import type { CatConnectionStatus } from '@/services/cat/connections';

export function useCatConnections() {
  const [connections, setConnections] = useState<CatConnectionStatus[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(API_ROUTES.CAT.CONNECTIONS, { signal });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const data = await res.json();
      setConnections(data?.data?.connections ?? []);
      setFailed(false);
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') {
        setFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { connections, failed, reload: load };
}
