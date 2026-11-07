import { createAdminClient } from '@/lib/supabase/admin';
import { DISCOVER_ORDER } from '@/config/discover-tabs';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { embedText, embeddingsEnabled } from '@/services/ai/embeddings';
import { logger } from '@/utils/logger';
import {
  FIXTURE_RPC_ARGS,
  isFixtureHit,
  toPublicHit,
  type PublicHitType,
  type SearchRow,
} from './public-search';
import type { SemanticPublicHit } from './hybrid-ranking';

const MIN_SIMILARITY = 0.35;
interface VectorHit {
  entity_type: string;
  entity_id: string;
  similarity: number;
}
const idFor = (type: string, id: string) => `${type}:${id}`;

/** Index vectors select candidates. Current public rows supply EVERY returned field. */
export async function semanticPublicSearch(
  client: AnySupabaseClient,
  query: string,
  type?: PublicHitType
): Promise<SemanticPublicHit[]> {
  if (!embeddingsEnabled()) {
    return [];
  }
  try {
    const vector = await embedText(query);
    if (!vector) {
      return [];
    }
    // The vector index is server-only under RLS; the caller's client is used
    // only for the public-row lookup below. Never return raw index metadata.
    const { data, error } = await createAdminClient().rpc('match_content', {
      query_embedding: JSON.stringify(vector),
      match_count: 30,
      ...(type ? { filter_type: type } : {}),
      min_similarity: MIN_SIMILARITY,
    });
    if (error) {
      throw new Error('Semantic candidates unavailable');
    }
    const candidates = ((data ?? []) as VectorHit[]).filter(
      row =>
        Number.isFinite(row.similarity) &&
        row.similarity >= MIN_SIMILARITY &&
        DISCOVER_ORDER.some(kind => kind === row.entity_type) &&
        (!type || row.entity_type === type)
    );
    if (!candidates.length) {
      return [];
    }
    const { data: current, error: lookupError } = await client.rpc('lookup_public_documents', {
      p_keys: candidates.map(row => ({ type: row.entity_type, id: row.entity_id })),
      ...FIXTURE_RPC_ARGS,
    } as never);
    if (lookupError) {
      throw new Error('Current public candidates unavailable');
    }
    const live = new Map(
      ((current ?? []) as SearchRow[])
        .filter(row => !isFixtureHit(row))
        .map(row => [idFor(row.entity_type, row.id), toPublicHit(row)])
    );
    // Preserve vector order; the lookup's row order has no relevance meaning.
    return candidates.flatMap(candidate => {
      const hit = live.get(idFor(candidate.entity_type, candidate.entity_id));
      return hit ? [{ ...hit, similarity: Math.round(candidate.similarity * 1000) / 1000 }] : [];
    });
  } catch (error) {
    logger.warn(
      'Semantic search unavailable; retaining ranked lexical results',
      { error },
      'Search'
    );
    return [];
  }
}
