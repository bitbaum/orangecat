/**
 * Companion memory — what a companion remembers about ONE person.
 *
 * Keyed by (assistant_id, user_id): the memory belongs to the relationship,
 * not to the companion. A clone copies the companion's definition and none of
 * these rows; the companion's creator never reads another person's rows.
 *
 * Two ways a memory gets written after a turn:
 *   1. Stated lines — anything the companion itself wrote that starts with a
 *      log prefix (`Method log |`, `Do not |`, `About |`) is stored verbatim,
 *      no model call. A companion whose prompt keeps a log writes the log.
 *   2. Distilled facts — when the person disclosed something about themselves,
 *      one small temperature-0 call distils ≤3 durable third-person facts.
 *
 * Deliberately self-contained: this module must never import from
 * services/cat — Cat is the platform's mind, a companion is not.
 * Enforced by __tests__/unit/companions/import-boundary.test.ts.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { embedTexts, embeddingsEnabled } from '@/services/ai/embeddings';
import { looksLikeSelfDisclosure } from '@/services/ai/self-disclosure';
import { logger } from '@/utils/logger';

const LOG = 'CompanionMemory';

/** Memories recalled per turn, and the similarity floor for recall. */
const RECALL_COUNT = 6;
const RECALL_MIN_SIMILARITY = 0.3;
/** Above this cosine similarity a new fact is a duplicate of a stored one. */
const DEDUP_SIMILARITY = 0.88;
/** Cap facts distilled from a single exchange. */
const MAX_FACTS_PER_TURN = 3;
/** Soft cap per (companion, person); oldest beyond this are pruned on write. */
export const MAX_MEMORIES_PER_PAIR = 300;
/** Trim any single memory to this length before storing. */
export const MAX_MEMORY_CHARS = 240;

/**
 * A line the companion writes with one of these prefixes is a memory it
 * chose to keep, stored verbatim. The healer persona's method log uses them.
 */
export const STATED_MEMORY_PREFIXES = ['Method log |', 'Do not |', 'About |'] as const;

export interface CompanionMemory {
  id: string;
  content: string;
  created_at: string;
}

export interface CompanionMemoryKey {
  assistantId: string;
  userId: string;
}

/** Minimal AI service shape used for distillation (matches the chat provider). */
export interface CompanionMemoryAiService {
  chatCompletion(opts: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
  }): Promise<{ content: string }>;
}

// ─── Recall ───────────────────────────────────────────────────────────────────

/**
 * The memories most relevant to the current message, for this pair only.
 * Returns [] (never throws) when embeddings are off or anything fails.
 */
export async function recallCompanionMemories(
  supabase: AnySupabaseClient,
  key: CompanionMemoryKey,
  queryText: string
): Promise<CompanionMemory[]> {
  if (!embeddingsEnabled() || !queryText?.trim()) {
    return [];
  }
  try {
    const [vec] = await embedTexts([queryText]);
    if (!vec) {
      return [];
    }
    const { data, error } = await supabase.rpc('match_companion_memories', {
      p_assistant_id: key.assistantId,
      p_user_id: key.userId,
      query_embedding: JSON.stringify(vec),
      match_count: RECALL_COUNT,
      min_similarity: RECALL_MIN_SIMILARITY,
    });
    if (error) {
      logger.warn('Companion memory recall failed', { error: error.message }, LOG);
      return [];
    }
    return (data ?? []) as CompanionMemory[];
  } catch (error) {
    logger.warn('Companion memory recall threw', { error: String(error) }, LOG);
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface RememberResult {
  stored: string[];
  duplicates: string[];
}

/**
 * Store memories for one pair. Dedupes by similarity when embeddings are on
 * (a stated log line for the same probe twice is NOT a duplicate — pass
 * `dedupe: false` for those). Prunes the oldest rows past the cap.
 */
export async function rememberCompanionFacts(
  supabase: AnySupabaseClient,
  key: CompanionMemoryKey,
  facts: string[],
  opts: { dedupe?: boolean; source?: string; conversationId?: string | null } = {}
): Promise<RememberResult> {
  const dedupe = opts.dedupe ?? true;
  const wanted = [...new Set(facts.map(f => f.trim().slice(0, MAX_MEMORY_CHARS)))].filter(
    f => f.length >= 3
  );
  const result: RememberResult = { stored: [], duplicates: [] };
  if (wanted.length === 0) {
    return result;
  }

  const vectors = embeddingsEnabled() ? await embedTexts(wanted) : wanted.map(() => null);
  const rows: Array<{
    assistant_id: string;
    user_id: string;
    content: string;
    embedding: string | null;
    source: string;
    source_conversation_id: string | null;
  }> = [];

  for (let i = 0; i < wanted.length; i++) {
    const vec = vectors[i];
    if (dedupe && vec) {
      const { data: near } = await supabase.rpc('match_companion_memories', {
        p_assistant_id: key.assistantId,
        p_user_id: key.userId,
        query_embedding: JSON.stringify(vec),
        match_count: 1,
        min_similarity: DEDUP_SIMILARITY,
      });
      if (Array.isArray(near) && near.length > 0) {
        result.duplicates.push(wanted[i]);
        continue;
      }
    }
    rows.push({
      assistant_id: key.assistantId,
      user_id: key.userId,
      content: wanted[i],
      embedding: vec ? JSON.stringify(vec) : null,
      source: opts.source ?? 'chat',
      source_conversation_id: opts.conversationId ?? null,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from(DATABASE_TABLES.COMPANION_MEMORIES).insert(rows);
    if (error) {
      logger.error('Companion memory insert failed', error, LOG);
      return result;
    }
    result.stored = rows.map(r => r.content);
    await pruneIfNeeded(supabase, key);
  }
  return result;
}

/** Oldest-first prune past the per-pair cap. Never crosses to another pair. */
async function pruneIfNeeded(supabase: AnySupabaseClient, key: CompanionMemoryKey): Promise<void> {
  const { count } = await supabase
    .from(DATABASE_TABLES.COMPANION_MEMORIES)
    .select('id', { count: 'exact', head: true })
    .eq('assistant_id', key.assistantId)
    .eq('user_id', key.userId);
  if (!count || count <= MAX_MEMORIES_PER_PAIR) {
    return;
  }
  const { data: oldest } = await supabase
    .from(DATABASE_TABLES.COMPANION_MEMORIES)
    .select('id')
    .eq('assistant_id', key.assistantId)
    .eq('user_id', key.userId)
    .order('created_at', { ascending: true })
    .limit(count - MAX_MEMORIES_PER_PAIR);
  const ids = (oldest as Array<{ id: string }> | null)?.map(r => r.id) ?? [];
  if (ids.length > 0) {
    await supabase
      .from(DATABASE_TABLES.COMPANION_MEMORIES)
      .delete()
      .eq('user_id', key.userId)
      .in('id', ids);
  }
}

// ─── Read / forget ────────────────────────────────────────────────────────────

export async function listCompanionMemories(
  supabase: AnySupabaseClient,
  key: CompanionMemoryKey
): Promise<CompanionMemory[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.COMPANION_MEMORIES)
    .select('id, content, created_at')
    .eq('assistant_id', key.assistantId)
    .eq('user_id', key.userId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('Companion memory list failed', { error: error.message }, LOG);
    return [];
  }
  return (data ?? []) as CompanionMemory[];
}

export async function deleteCompanionMemory(
  supabase: AnySupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from(DATABASE_TABLES.COMPANION_MEMORIES)
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  return !error;
}

export async function deleteAllCompanionMemories(
  supabase: AnySupabaseClient,
  key: CompanionMemoryKey
): Promise<boolean> {
  const { error } = await supabase
    .from(DATABASE_TABLES.COMPANION_MEMORIES)
    .delete()
    .eq('user_id', key.userId)
    .eq('assistant_id', key.assistantId);
  return !error;
}

// ─── Post-turn extraction ─────────────────────────────────────────────────────

/** Lines the companion wrote that it chose to remember, verbatim. */
export function statedMemoryLines(assistantMessage: string): string[] {
  return assistantMessage
    .split('\n')
    .map(l => l.replace(/^[\s>*-]+/, '').trim())
    .filter(l => STATED_MEMORY_PREFIXES.some(p => l.startsWith(p)));
}

const DISTILL_SYSTEM = `You are the memory of a companion. From one exchange, extract durable facts about the PERSON talking to the companion that will still be true next week: identity, preferences, relationships, goals, constraints, what they are going through.

Return ONLY a JSON array of short statements in the third person, e.g.:
["Lives in Zürich", "Has a sister she calls every Sunday", "Is changing careers into design"]

EXCLUDE one-off requests, questions, the companion's own words, transient moods, and anything trivial.
If nothing durable was said, return exactly [].
At most ${MAX_FACTS_PER_TURN} facts. No prose, no markdown — just the JSON array.`;

/** Parse the model's reply into a clean list of fact strings (defensive). */
export function parseDistilledFacts(raw: string): string[] {
  if (!raw) {
    return [];
  }
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }
  try {
    const arr: unknown = JSON.parse(match[0]);
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim().slice(0, MAX_MEMORY_CHARS))
      .filter(s => s.length >= 3)
      .slice(0, MAX_FACTS_PER_TURN);
  } catch {
    return [];
  }
}

export interface ExtractCompanionMemoriesArgs extends CompanionMemoryKey {
  conversationId: string | null;
  userMessage: string;
  assistantMessage: string;
  aiService: CompanionMemoryAiService;
  model: string;
}

/**
 * Fire-and-forget after a turn. Stated lines cost nothing; distillation runs
 * only when the person actually disclosed something. Never throws.
 */
export async function extractCompanionMemories(
  supabase: AnySupabaseClient,
  args: ExtractCompanionMemoriesArgs
): Promise<void> {
  const key = { assistantId: args.assistantId, userId: args.userId };
  try {
    const stated = statedMemoryLines(args.assistantMessage);
    if (stated.length > 0) {
      await rememberCompanionFacts(supabase, key, stated, {
        dedupe: false,
        source: 'stated',
        conversationId: args.conversationId,
      });
    }

    if (!looksLikeSelfDisclosure(args.userMessage)) {
      return;
    }
    const { content } = await args.aiService.chatCompletion({
      model: args.model,
      temperature: 0,
      messages: [
        { role: 'system', content: DISTILL_SYSTEM },
        {
          role: 'user',
          content: `Person: ${args.userMessage.slice(0, 2000)}\n\nCompanion: ${args.assistantMessage.slice(0, 1200)}`,
        },
      ],
    });
    const facts = parseDistilledFacts(content);
    if (facts.length > 0) {
      await rememberCompanionFacts(supabase, key, facts, {
        conversationId: args.conversationId,
      });
    }
  } catch (error) {
    logger.warn('Companion memory extraction failed', { error: String(error) }, LOG);
  }
}
