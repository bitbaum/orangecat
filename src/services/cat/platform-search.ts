/** Cat, the public API and MCP use Discover's ranked public corpus. */
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DISCOVER_ORDER, DISCOVER_TYPE_SLUGS } from '@/config/discover-tabs';
import { SEARCH_TYPES, type SearchType } from '@/config/public-search-types';
export { SEARCH_TYPES, type SearchType };
import { findPublic } from '@/services/search/find';
import { semanticPublicSearch } from '@/services/search/semantic-public';
import { mergePublicRankings } from '@/services/search/hybrid-ranking';

/** Same public kinds and URL words as Discover; private wallets/documents are excluded. */
export interface SearchResult {
  type: SearchType;
  title: string;
  description: string;
  url: string;
  similarity?: number;
}

export async function searchPlatform(
  supabase: AnySupabaseClient,
  query: string,
  type: SearchType = 'all'
): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 120);
  if (!q) {
    return [];
  }
  const kind = DISCOVER_ORDER.find(kind => DISCOVER_TYPE_SLUGS[kind] === type);
  if (type !== 'all' && !kind) {
    throw new Error('Unknown public search kind');
  }
  const limit = type === 'all' ? 30 : 5;
  const [lexical, semantic] = await Promise.all([
    findPublic(q, { types: kind ? [kind] : undefined, limit, perType: 5 }),
    semanticPublicSearch(supabase, q, kind),
  ]);
  return mergePublicRankings(
    q,
    lexical.hits.filter(hit => DISCOVER_ORDER.some(kind => kind === hit.type)),
    semantic,
    limit
  ).map(hit => ({
    type: DISCOVER_TYPE_SLUGS[hit.type] as SearchType,
    title: hit.title,
    description: hit.snippet,
    url: hit.href,
    ...(hit.similarity === undefined ? {} : { similarity: hit.similarity }),
  }));
}
