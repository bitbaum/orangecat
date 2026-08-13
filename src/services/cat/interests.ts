/**
 * Interests — the bridge from what the Cat privately learns to what makes a
 * person findable.
 *
 * The problem this solves is measurable: of 148 profiles, 5 carry a bio. Topic
 * search could therefore only ever find people who had already published an
 * entity, which is a high bar. An interest is one phrase, captured from a
 * conversation the user was already having, and it makes them discoverable
 * immediately.
 *
 * The privacy rule is absolute and lives in two places on purpose: publishing
 * is a separate, explicitly-confirmed write into a public-by-design table
 * (see the migration), and the action that calls it is high-risk so it can
 * never be automated. The Cat may *propose*; only the user publishes.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { embeddingsEnabled, embedText } from '@/services/ai/embeddings';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { DiscoveryPerson } from './discovery-types';
import { ROUTES } from '@/config/routes';

const LOG_SOURCE = 'CatInterests';

export const MAX_TOPIC_LENGTH = 80;
const MIN_TOPIC_LENGTH = 2;
/** Above this two phrasings mean the same interest ("longevity" ~ "long life"). */
const PEOPLE_MIN_SIMILARITY = 0.45;
const PEOPLE_MATCH_COUNT = 8;
/** A person is a directory, not a tag cloud. */
export const MAX_INTERESTS_PER_USER = 40;

/** Filler that carries no topical meaning, so it never reaches the stored phrase. */
const LEADING_FILLER =
  /^(?:i(?:'m| am)?\s+)?(?:really\s+|very\s+|quite\s+)?(?:interested\s+in|into|curious\s+about|passionate\s+about|keen\s+on)\s+/i;

export interface Interest {
  id: string;
  topic: string;
  normalized: string;
  source: 'cat' | 'manual';
  createdAt: string;
}

/**
 * Reduce a phrase to its dedupe key. Deliberately conservative: it strips
 * lead-in filler and punctuation but never stems, because "longevity" and
 * "longevity research" are genuinely different interests and collapsing them
 * would silently rewrite what someone published about themselves.
 */
export function normalizeTopic(raw: string): string {
  return collapse(raw)
    .toLowerCase()
    .replace(LEADING_FILLER, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim();
}

/** The display form: filler stripped, original casing otherwise preserved. */
export function cleanTopic(raw: string): string {
  return collapse(raw)
    .replace(LEADING_FILLER, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim()
    .slice(0, MAX_TOPIC_LENGTH);
}

/**
 * Whitespace is collapsed FIRST so the filler pattern's `^` anchor still bites
 * on padded input — otherwise "  interested in longevity" would be stored as a
 * separate interest from "longevity".
 */
function collapse(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function isValidTopic(topic: string): boolean {
  const n = normalizeTopic(topic);
  return n.length >= MIN_TOPIC_LENGTH && n.length <= MAX_TOPIC_LENGTH;
}

/**
 * Make an interest discoverable. Idempotent per (user, normalized topic) — the
 * unique index means re-publishing is a no-op rather than a duplicate row.
 */
export async function publishInterest(
  supabase: AnySupabaseClient,
  userId: string,
  rawTopic: string
): Promise<{ ok: true; topic: string; alreadyPublished: boolean } | { ok: false; error: string }> {
  const topic = cleanTopic(rawTopic);
  const normalized = normalizeTopic(rawTopic);
  if (!isValidTopic(rawTopic)) {
    return {
      ok: false,
      error: `"${rawTopic}" is not a usable interest — give a short topic between ${MIN_TOPIC_LENGTH} and ${MAX_TOPIC_LENGTH} characters.`,
    };
  }

  const existing = await listInterests(supabase, userId);
  if (existing.some(i => i.normalized === normalized)) {
    return { ok: true, topic, alreadyPublished: true };
  }
  if (existing.length >= MAX_INTERESTS_PER_USER) {
    return {
      ok: false,
      error: `You already have ${existing.length} published interests (max ${MAX_INTERESTS_PER_USER}). Remove one first.`,
    };
  }

  // No embedding → the row would be invisible to matching, which is the entire
  // point of publishing. Fail loudly instead of storing a decoration.
  if (!embeddingsEnabled()) {
    return { ok: false, error: 'Interest matching is unavailable right now — try again later.' };
  }
  const vec = await embedText(topic);
  if (!vec) {
    return { ok: false, error: 'Could not index that interest right now — try again later.' };
  }

  const { error } = await supabase.from(DATABASE_TABLES.CAT_INTERESTS).insert({
    user_id: userId,
    topic,
    normalized,
    embedding: JSON.stringify(vec),
    source: 'cat',
  });
  if (error) {
    logger.error('publishInterest failed', { error }, LOG_SOURCE);
    return { ok: false, error: 'Could not publish that interest.' };
  }
  return { ok: true, topic, alreadyPublished: false };
}

export async function listInterests(
  supabase: AnySupabaseClient,
  userId: string
): Promise<Interest[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.CAT_INTERESTS)
    .select('id, topic, normalized, source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(r => ({
    id: String(r.id),
    topic: String(r.topic),
    normalized: String(r.normalized),
    source: r.source === 'manual' ? 'manual' : 'cat',
    createdAt: String(r.created_at),
  }));
}

/** Stop being discoverable for a topic. Matches on the normalized form. */
export async function unpublishInterest(
  supabase: AnySupabaseClient,
  userId: string,
  rawTopic: string
): Promise<{ ok: boolean; removed: string | null }> {
  const normalized = normalizeTopic(rawTopic);
  const match = (await listInterests(supabase, userId)).find(i => i.normalized === normalized);
  if (!match) {
    return { ok: false, removed: null };
  }
  const { error } = await supabase
    .from(DATABASE_TABLES.CAT_INTERESTS)
    .delete()
    .eq('id', match.id)
    .eq('user_id', userId);
  return { ok: !error, removed: error ? null : match.topic };
}

/**
 * People who declared an interest close to this topic. This is what lets
 * someone be found on day one, before they have published anything at all.
 */
export async function findPeopleByInterest(
  supabase: AnySupabaseClient,
  viewerUserId: string,
  topic: string,
  /** Reuse the caller's vector for this same topic — saves a round trip and its cost. */
  precomputedEmbedding?: number[] | null
): Promise<DiscoveryPerson[]> {
  if (!topic.trim() || !embeddingsEnabled()) {
    return [];
  }
  try {
    const vec = precomputedEmbedding ?? (await embedText(topic));
    if (!vec) {
      return [];
    }
    const { data, error } = await supabase.rpc('match_interested_people', {
      query_embedding: JSON.stringify(vec),
      exclude_user: viewerUserId,
      match_count: PEOPLE_MATCH_COUNT,
      min_similarity: PEOPLE_MIN_SIMILARITY,
    });
    if (error || !data) {
      logger.warn('match_interested_people failed', { error }, LOG_SOURCE);
      return [];
    }

    const rows = data as { user_id: string; topic: string }[];
    if (rows.length === 0) {
      return [];
    }

    const { data: profiles } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id, username, name')
      .in(
        'id',
        rows.map(r => r.user_id)
      );
    type ProfileRow = { id: string; username: string | null; name: string | null };
    const byId = new Map<string, ProfileRow>(
      ((profiles ?? []) as ProfileRow[]).map(p => [p.id, p] as const)
    );

    const people: DiscoveryPerson[] = [];
    for (const r of rows) {
      const p = byId.get(r.user_id);
      // No readable profile → a name-less ghost. Drop it rather than show it.
      if (!p) {
        continue;
      }
      people.push({
        userId: r.user_id,
        displayName: p.name || p.username || 'Someone',
        username: p.username,
        profileUrl: p.username ? ROUTES.PROFILES.VIEW(p.username) : null,
        via: [`Interested in ${r.topic}`],
      });
    }
    return people;
  } catch (err) {
    logger.warn('findPeopleByInterest threw', { err }, LOG_SOURCE);
    return [];
  }
}
