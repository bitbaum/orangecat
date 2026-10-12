import { useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase/browser';
import { searchPublic, type PublicHit } from '@/services/search/public-search';

interface UseGlobalSearchResult {
  results: PublicHit[];
  /** How many public rows match in all — the palette shows a handful. */
  total: number;
  loading: boolean;
}

/**
 * Debounced, ranked, cross-entity search for the ⌘K palette. The same engine
 * as /discover (search_public), capped per type so one kind of thing cannot
 * fill the list. A monotonic request id keeps a slow earlier query from
 * overwriting a newer one.
 */
export function useGlobalSearch(
  query: string,
  enabled: boolean = true,
  limit: number = 12,
  debounceMs: number = 200
): UseGlobalSearchResult {
  const [results, setResults] = useState<PublicHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      requestIdRef.current++;
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const page = await searchPublic(supabase, { query, limit, perType: 4 });
      if (requestId === requestIdRef.current) {
        setResults(page.hits);
        setTotal(page.total);
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, enabled, limit, debounceMs]);

  return { results, total, loading };
}
