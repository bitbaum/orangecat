import { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';
import { profileListToConnections, type Connection } from './usePeopleConnections';

const SEARCH_DELAY_MS = 250;
const SEARCH_LIMIT = 100;

/**
 * Search everyone on the server. "Everyone" used to filter the 100 rows already
 * loaded in the browser, so a person outside that page (Marco Rossi) could
 * never be found by name. Null while there is no term, so the caller shows the
 * default list.
 */
export function useEveryoneSearch(term: string): {
  results: Connection[] | null;
  searching: boolean;
} {
  const q = term.trim();
  const [results, setResults] = useState<Connection[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const url = `${API_ROUTES.PROFILES.BASE}?limit=${SEARCH_LIMIT}&search=${encodeURIComponent(q)}`;
        const res = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
        const body = res.ok ? await res.json() : null;
        setResults(body?.success ? profileListToConnections(body.data) : []);
      } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
          logger.warn('People search failed', { error }, 'PeoplePage');
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return { results, searching };
}
