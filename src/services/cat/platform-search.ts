/**
 * Platform Search Service
 *
 * Enables Cat to search OrangeCat for users, projects, products,
 * services, events, and causes.
 *
 * Implementation: ILIKE pattern matching on title/description/bio.
 * Fast enough at current scale. Upgrade path: add pgvector when needed;
 * this interface stays stable so no code debt is introduced by waiting.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getTableName, getEntityMetadata } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_STATUS } from '@/config/database-constants';
import { embeddingsEnabled, embedText } from '@/services/ai/embeddings';
import { logger } from '@/utils/logger';

export type SearchType =
  | 'all'
  | 'people'
  | 'projects'
  | 'products'
  | 'services'
  | 'events'
  | 'causes';

export interface SearchResult {
  type: SearchType;
  title: string;
  description: string;
  url: string;
  /** Cosine similarity 0–1 for semantic hits (absent for keyword hits). Lets the
   *  Cat distinguish a strong match from a loosely-related one. */
  similarity?: number;
}

const MAX_RESULTS_PER_TYPE = 5;

/** Public detail-page base path for an entity type — SSOT is the registry, never a literal. */
const pubPath = (type: Parameters<typeof getEntityMetadata>[0]): string =>
  getEntityMetadata(type).publicBasePath;

/**
 * Search the platform for users and entities.
 * Returns up to 5 results per requested type (max 30 for 'all').
 */
export async function searchPlatform(
  supabase: AnySupabaseClient,
  query: string,
  type: SearchType = 'all'
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  // 1) Semantic search (meaning-based) when an embedding provider is configured
  //    AND the index has data. Ranks by conceptual similarity, so "help me
  //    launch a hardware gadget" finds an "electronics prototyping" profile.
  //    Falls through to keyword search if disabled, empty index, or no hits.
  if (embeddingsEnabled()) {
    try {
      const semantic = await semanticSearch(supabase, q, type);
      if (semantic.length > 0) {
        return semantic;
      }
    } catch (err) {
      logger.warn('Semantic search failed, falling back to keyword', { err }, 'PlatformSearch');
    }
  }

  // 2) Keyword fallback (tokenized ILIKE) — always works, no provider needed.
  // Tokenize: match ANY significant word (OR), not the whole phrase. A model
  // query like "tattoo artist collaboration" must match a bio that says
  // "Tattoo artist based in Berlin" — a single %phrase% ILIKE never would.
  // (Recall-first; pgvector semantic ranking is the next slice.) Split on
  // non-alphanumerics so tokens are safe to embed in PostgREST .or() strings.
  let tokens = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length >= 3 && !SEARCH_STOPWORDS.has(t))
    .slice(0, 6);
  if (tokens.length === 0) {
    tokens = [
      q
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, '')
        .trim(),
    ].filter(Boolean);
  }
  if (tokens.length === 0) {
    return [];
  }
  const results: SearchResult[] = [];

  await Promise.all([
    type === 'all' || type === 'people'
      ? searchProfiles(supabase, tokens, results)
      : Promise.resolve(),
    type === 'all' || type === 'projects'
      ? searchTable(
          supabase,
          getTableName('project'),
          'projects',
          pubPath('project'),
          tokens,
          results
        )
      : Promise.resolve(),
    type === 'all' || type === 'causes'
      ? searchTable(supabase, getTableName('cause'), 'causes', pubPath('cause'), tokens, results)
      : Promise.resolve(),
    type === 'all' || type === 'products'
      ? searchTable(
          supabase,
          getTableName('product'),
          'products',
          pubPath('product'),
          tokens,
          results
        )
      : Promise.resolve(),
    type === 'all' || type === 'services'
      ? searchTable(
          supabase,
          getTableName('service'),
          'services',
          pubPath('service'),
          tokens,
          results
        )
      : Promise.resolve(),
    type === 'all' || type === 'events'
      ? searchTable(supabase, getTableName('event'), 'events', pubPath('event'), tokens, results)
      : Promise.resolve(),
  ]);

  return results;
}

/** Query-framing words that add noise to matchmaking searches, not signal. */
const SEARCH_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'you',
  'your',
  'who',
  'whom',
  'find',
  'need',
  'want',
  'looking',
  'someone',
  'anyone',
  'somebody',
  'collaborate',
  'collaboration',
  'collaborator',
  'partner',
  'platform',
  'orangecat',
  'people',
  'person',
  'can',
  'help',
  'near',
  'about',
]);

/** Build a PostgREST `.or()` string: any token, in any field (tokens are
 *  alphanumeric-only so they're safe to interpolate). */
function ilikeOrConditions(fields: string[], tokens: string[]): string {
  return tokens.flatMap(t => fields.map(f => `${f}.ilike.%${t}%`)).join(',');
}

// ─── Semantic search (pgvector) ──────────────────────────────────────────────

/** SearchType (Cat-facing) → content_embeddings.entity_type (stored). */
const TYPE_TO_ENTITY: Record<SearchType, string | null> = {
  all: null,
  people: 'profile',
  projects: 'project',
  products: 'product',
  services: 'service',
  events: 'event',
  causes: 'cause',
};

/** content_embeddings.entity_type → SearchType (for result mapping). */
const ENTITY_TO_TYPE: Record<string, SearchType> = {
  profile: 'people',
  project: 'projects',
  product: 'products',
  service: 'services',
  event: 'events',
  cause: 'causes',
};

/** Minimum cosine similarity to count as a real match. 0.35 keeps on-topic hits
 *  (e.g. a tattoo artist for "ink a design on my skin" ~0.45) while dropping
 *  loose neighbours (a ceramicist/engineer ~0.2–0.3) that were polluting results. */
const MIN_SIMILARITY = 0.35;

async function semanticSearch(
  supabase: AnySupabaseClient,
  query: string,
  type: SearchType
): Promise<SearchResult[]> {
  const vec = await embedText(query);
  if (!vec) {
    return [];
  }
  const { data, error } = await supabase.rpc('match_content', {
    // pgvector accepts its text format ("[0.1,0.2,…]") for the vector param.
    query_embedding: JSON.stringify(vec),
    match_count: type === 'all' ? 12 : 6,
    filter_type: TYPE_TO_ENTITY[type] ?? null,
    // Relevance gate in SQL; results come back ordered by a blended score
    // (similarity + a small quality_score boost) — outcome-aware ranking.
    min_similarity: MIN_SIMILARITY,
  });
  if (error || !data) {
    if (error) {
      logger.warn('match_content RPC failed', { error }, 'PlatformSearch');
    }
    return [];
  }
  return (
    data as Array<{
      entity_type: string;
      title: string | null;
      url: string | null;
      text_preview: string | null;
      similarity: number;
    }>
  )
    .filter(r => r.similarity >= MIN_SIMILARITY)
    .map(r => ({
      type: ENTITY_TO_TYPE[r.entity_type] ?? 'all',
      title: r.title || 'Untitled',
      description: r.text_preview?.slice(0, 200) || '',
      url: r.url || '#',
      similarity: Math.round(r.similarity * 100) / 100,
    }));
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function searchProfiles(
  supabase: AnySupabaseClient,
  tokens: string[],
  results: SearchResult[]
): Promise<void> {
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('username, name, bio')
    .not('username', 'is', null)
    .or(ilikeOrConditions(['username', 'name', 'bio'], tokens))
    .limit(MAX_RESULTS_PER_TYPE);

  if (!data?.length) {
    return;
  }

  for (const row of data as Array<{
    username: string;
    name: string | null;
    bio: string | null;
  }>) {
    results.push({
      type: 'people',
      title: row.name || row.username,
      description: row.bio?.slice(0, 200) || `@${row.username} on OrangeCat`,
      url: `/profiles/${row.username}`,
    });
  }
}

async function searchTable(
  supabase: AnySupabaseClient,
  table: string,
  type: SearchType,
  basePath: string,
  tokens: string[],
  results: SearchResult[]
): Promise<void> {
  const { data } = await supabase
    .from(table)
    .select('id, title, description')
    .eq('status', ENTITY_STATUS.ACTIVE)
    .or(ilikeOrConditions(['title', 'description'], tokens))
    .limit(MAX_RESULTS_PER_TYPE);

  if (!data?.length) {
    return;
  }

  for (const row of data as Array<{
    id: string;
    title: string;
    description: string | null;
  }>) {
    results.push({
      type,
      title: row.title,
      description: row.description?.slice(0, 200) || '',
      url: `${basePath}/${row.id}`,
    });
  }
}
