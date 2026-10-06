/**
 * Cat Memory Service
 *
 * Persistent, semantic memory for My Cat. Durable facts about a user
 * ("Prefers Lightning over on-chain", "Building Loki") are extracted
 * from chat, embedded, and recalled by MEANING on later turns — so Cat keeps
 * context across sessions instead of re-deriving everything each time.
 *
 * Two paths, both best-effort and non-blocking (Cat never breaks if memory is
 * unavailable — missing table, no embeddings provider, or a failed LLM call all
 * degrade to "no memory this turn"):
 *   - recallMemories():       embed the current message → nearest stored facts
 *   - extractAndStoreMemories(): after a turn, distil new durable facts → store
 *
 * Reuses the platform's 1536-dim pgvector setup (see content_embeddings) via the
 * match_cat_memories RPC. Privacy: cat_memories is RLS-scoped to the owner, and
 * users can view/delete everything Cat remembers (Settings → AI).
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { embeddingsEnabled, embedText, embedTexts } from '@/services/ai/embeddings';
import { logger } from '@/utils/logger';
import { looksLikeSelfDisclosure } from '@/services/ai/self-disclosure';
import {
  containsWholeWords,
  phrasesOverlap,
  significantStems,
  stemOverlapMatches,
} from './memory-matching';
import { parseImportedMemories } from './memory-import-parse';

export { containsWholeWords } from './memory-matching';
export { parseImportedMemories } from './memory-import-parse';

export interface CatMemory {
  id: string;
  content: string;
  /** Cosine similarity to the recall query (0–1), present only on recall. */
  similarity?: number;
  created_at: string;
}

/** How many memories to recall and inject per turn. */
const RECALL_COUNT = 6;
/** Relevance floor for recall — below this a memory isn't worth injecting. */
const RECALL_MIN_SIMILARITY = 0.3;
/** A candidate fact this close to an existing one is treated as already known. */
const DEDUP_SIMILARITY = 0.88;
/** Cap facts distilled from a single exchange — keeps extraction cheap + focused. */
const MAX_FACTS_PER_TURN = 3;
/** Soft cap per user; oldest beyond this are pruned on write. */
const MAX_MEMORIES_PER_USER = 300;
/** Trim any single fact to this length before storing. */
const MAX_FACT_CHARS = 240;

/** Minimal Ai service shape used for extraction (matches the chat provider). */
export interface MemoryAiService {
  chatCompletion(opts: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
  }): Promise<{ content: string }>;
}

// ─── Recall ───────────────────────────────────────────────────────────────────

/**
 * Recall the memories most relevant to the current message. Returns [] (never
 * throws) when embeddings are disabled, the query is empty, or anything fails.
 */
export async function recallMemories(
  supabase: AnySupabaseClient,
  userId: string,
  queryText: string
): Promise<CatMemory[]> {
  if (!embeddingsEnabled() || !queryText?.trim()) {
    return [];
  }
  try {
    const vec = await embedText(queryText);
    if (!vec) {
      return [];
    }
    const { data, error } = await supabase.rpc('match_cat_memories', {
      p_user_id: userId,
      // pgvector accepts its text format ("[0.1,0.2,…]") for the vector param.
      query_embedding: JSON.stringify(vec),
      match_count: RECALL_COUNT,
      min_similarity: RECALL_MIN_SIMILARITY,
    });
    if (error) {
      logger.warn('match_cat_memories RPC failed', { error }, 'CatMemory');
      return [];
    }
    return (data ?? []) as CatMemory[];
  } catch (err) {
    logger.warn('recallMemories threw', { err }, 'CatMemory');
    return [];
  }
}

// ─── Forgetting ─────────────────────────────────────────────────────────────

/** What a forget request actually did — the model reports THIS, never a guess. */
export interface ForgetResult {
  /** Contents of the memories that were deleted. */
  deleted: string[];
  /** Requested facts for which no stored memory matched. */
  notFound: string[];
  /**
   * Facts we could not answer for, because the database did not respond.
   *
   * Distinct from `notFound`, and the distinction is the whole point: "we
   * looked and you have no such memory" and "we could not look" used to be the
   * same value. A failed delete reported `notFound`, so Cat told the user
   * nothing matched — while the memory they had just disowned was still there.
   * Telling someone their data is gone when it is not is the worst thing this
   * feature can do. bitbaum/orangecat#563 finding 8.
   */
  failed: string[];
}

/**
 * Semantic floor for treating a stored memory as "the fact the user means".
 * Measured against prod embeddings (text-embedding-3-small): true targets of a
 * short forget phrase score 0.39–0.61 ("speaking French" → "Knows French" =
 * 0.61, "weekend availability constraint" → "Can only work on weekends." =
 * 0.52) while unrelated memories stay ≤ 0.29. The original 0.75 floor was
 * near-identical-text territory and never fired for real phrasings.
 */
const FORGET_MATCH_SIMILARITY = 0.45;
/** Bound one forget call — the model should pass targeted facts, not essays. */
const MAX_FORGET_FACTS = 10;
/** Ignore degenerate fragments ("a", "is") that would text-match everything. */
const MIN_FORGET_FRAGMENT_CHARS = 4;

/**
 * Which of the requested facts a forget call will actually look for — and which
 * it will not, named rather than dropped.
 *
 * Three places used to decide this independently and disagree:
 * forgetMemoriesMatching trimmed, required 4 characters and capped at 10;
 * removeFromEconomicProfile trimmed, required 4 characters and had NO cap; and
 * the handler compared the caller's RAW strings against the trimmed ones the
 * stores reported. The consequences were all the same shape — the user is not
 * told something was skipped:
 *
 *   * ask to forget 12 things and facts 11 and 12 vanished from the memory
 *     store with no mention, while the profile store still processed them;
 *   * pass " photography " with padding and it could never appear in the
 *     "no stored match" list, because that list was built by matching raw
 *     against trimmed;
 *   * pass "cat" and it silently did nothing at all.
 *
 * One selector, used by both stores and the handler, so all three agree by
 * construction and the leftovers have names. bitbaum/orangecat#563 findings
 * 10 and 11.
 */
export interface ForgetFactSelection {
  /** Normalised facts the stores will actually search for. */
  wanted: string[];
  /** Trimmed to nothing, or too short to match anything but noise. */
  tooShort: string[];
  /** Beyond the per-call cap: real requests, simply not attempted. */
  overCap: string[];
}

export function selectForgetFacts(facts: string[]): ForgetFactSelection {
  const trimmed = facts.map(f => f.trim());
  const tooShort = trimmed.filter(f => f.length < MIN_FORGET_FRAGMENT_CHARS);
  const usable = trimmed.filter(f => f.length >= MIN_FORGET_FRAGMENT_CHARS);
  return {
    wanted: usable.slice(0, MAX_FORGET_FACTS),
    tooShort,
    overCap: usable.slice(MAX_FORGET_FACTS),
  };
}

/**
 * Delete stored memories matching the given facts. Matching is deliberately
 * generous — the user says "photography doesn't apply to me", the stored row is
 * "Has photography skills, speaks French…" — so each fact matches by
 * case-insensitive containment in EITHER direction, plus semantic similarity
 * when embeddings are available. Deletion is scoped to the user's own rows.
 *
 * This is the ONLY write path Cat has to memory besides extraction; it returns
 * exactly what happened so the model can report truthfully.
 */
export async function forgetMemoriesMatching(
  supabase: AnySupabaseClient,
  userId: string,
  facts: string[]
): Promise<ForgetResult> {
  const { wanted } = selectForgetFacts(facts);
  const result: ForgetResult = { deleted: [], notFound: [], failed: [] };
  if (wanted.length === 0) {
    return result;
  }

  const { data: rows, error: loadError } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .select('id, content')
    .eq('user_id', userId);
  if (loadError) {
    // Could not read the corpus, so we cannot say anything about what matched.
    // Reporting notFound here would tell the user their memories are absent.
    logger.warn('forgetMemoriesMatching load failed', { error: loadError }, 'CatMemory');
    return { deleted: [], notFound: [], failed: wanted };
  }
  const corpus = (rows ?? []) as Array<{ id: string; content: string }>;

  const memoryStems = corpus.map(m => significantStems(m.content));

  const doomed = new Map<string, string>();
  for (const fact of wanted) {
    const norm = fact.toLowerCase();
    const factStems = significantStems(norm);
    // A MAJORITY of the fact's significant words must appear (stemmed) in the
    // memory: 1 of 1, 1 of 2, 2 of 3, 2 of 4… Stemming is what lets
    // "photography skills" hit "Is a professional photographer…" and
    // "speaking French" hit "Knows French" — the exact phrasings that used to
    // fall through and leave memories the user disowned in place.
    let matched = false;
    for (let i = 0; i < corpus.length; i++) {
      const m = corpus[i];
      const c = m.content.toLowerCase();
      // Containment either way, on WORD boundaries ("photography" ⊂ "Has
      // photography skills…"), or enough shared stems (see requiredStemHits —
      // two-word facts need TWO hits, so one shared "skills" cannot delete a
      // stranger).
      // Whole words only: raw containment let a 4-char fact delete every memory
      // that merely SPELLED it ("work" ⊂ network/framework/coworking).
      if (
        containsWholeWords(c, norm) ||
        containsWholeWords(norm, c) ||
        stemOverlapMatches(factStems, memoryStems[i])
      ) {
        doomed.set(m.id, m.content);
        matched = true;
      }
    }
    if (!matched && embeddingsEnabled()) {
      try {
        const vec = await embedText(fact);
        if (vec) {
          const { data: near } = await supabase.rpc('match_cat_memories', {
            p_user_id: userId,
            query_embedding: JSON.stringify(vec),
            match_count: 3,
            min_similarity: FORGET_MATCH_SIMILARITY,
          });
          for (const n of (Array.isArray(near) ? near : []) as CatMemory[]) {
            doomed.set(n.id, n.content);
            matched = true;
          }
        }
      } catch (err) {
        logger.warn('forget semantic match failed', { err }, 'CatMemory');
      }
    }
    if (!matched) {
      result.notFound.push(fact);
    }
  }

  if (doomed.size > 0) {
    const { error } = await supabase
      .from(DATABASE_TABLES.CAT_MEMORIES)
      .delete()
      .eq('user_id', userId)
      .in('id', [...doomed.keys()]);
    if (error) {
      // We DID match these — the delete is what failed, so the memories are
      // still there. Saying notFound would be the opposite of the truth.
      logger.warn('forgetMemoriesMatching delete failed', { error }, 'CatMemory');
      return { deleted: [], notFound: result.notFound, failed: [...doomed.values()] };
    }
    result.deleted.push(...doomed.values());
    // Remember WHAT was forgotten (suppression list) so passive extraction
    // can't quietly re-learn a fact the user just disowned from old context.
    await recordForgottenFacts(supabase, userId, [...doomed.values(), ...wanted]);
  }
  return result;
}

// ─── Suppression (deleted facts stay deleted) ────────────────────────────────

/**
 * A candidate this semantically close to a forgotten fact is the same fact
 * being re-learned. Below the paraphrase band measured for forget matching
 * (0.39–0.61) sits noise; re-extractions of the SAME fact land far higher, so
 * 0.6 blocks them without suppressing genuinely new information.
 */
const SUPPRESS_SIMILARITY = 0.6;
/** Bounded suppression list per user; oldest pruned beyond this. */
const MAX_FORGOTTEN_PER_USER = 200;

/** Best-effort: store forgotten contents + the user's phrasings, embedded. */
async function recordForgottenFacts(
  supabase: AnySupabaseClient,
  userId: string,
  phrases: string[]
): Promise<void> {
  try {
    const unique = [...new Set(phrases.map(p => p.trim().slice(0, MAX_FACT_CHARS)))].filter(
      p => p.length >= MIN_FORGET_FRAGMENT_CHARS
    );
    if (unique.length === 0) {
      return;
    }
    const vectors = embeddingsEnabled() ? await embedTexts(unique) : unique.map(() => null);
    const { error } = await supabase.from(DATABASE_TABLES.CAT_FORGOTTEN_FACTS).insert(
      unique.map((content, i) => ({
        user_id: userId,
        content,
        embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
      }))
    );
    if (error) {
      logger.warn('recordForgottenFacts insert failed', { error }, 'CatMemory');
      return;
    }
    // Prune the oldest beyond the cap (same pattern as memory pruning).
    const { count } = await supabase
      .from(DATABASE_TABLES.CAT_FORGOTTEN_FACTS)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (count && count > MAX_FORGOTTEN_PER_USER) {
      const { data: oldest } = await supabase
        .from(DATABASE_TABLES.CAT_FORGOTTEN_FACTS)
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(count - MAX_FORGOTTEN_PER_USER);
      const ids = (oldest as Array<{ id: string }> | null)?.map(r => r.id) ?? [];
      if (ids.length > 0) {
        // Scoped by user_id as well as id, for the same reason pruneIfNeeded is
        // — this inherited the pattern, and the gap with it.
        await supabase
          .from(DATABASE_TABLES.CAT_FORGOTTEN_FACTS)
          .delete()
          .eq('user_id', userId)
          .in('id', ids);
      }
    }
  } catch (err) {
    logger.warn('recordForgottenFacts threw', { err }, 'CatMemory');
  }
}

/** The user's current suppression phrases (newest first, bounded). */
async function loadForgottenContents(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from(DATABASE_TABLES.CAT_FORGOTTEN_FACTS)
      .select('content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_FORGOTTEN_PER_USER);
    return ((data ?? []) as Array<{ content: string }>).map(r => r.content);
  } catch {
    return [];
  }
}

/**
 * Is this candidate fact one the user already asked us to forget?
 * Lexical check against the suppression list, plus semantic check when a
 * vector is available. Exported for the extraction path and tests.
 */
export async function isSuppressedFact(
  supabase: AnySupabaseClient,
  userId: string,
  fact: string,
  vec: number[] | null,
  forgottenContents?: string[]
): Promise<boolean> {
  const contents = forgottenContents ?? (await loadForgottenContents(supabase, userId));
  if (contents.some(c => phrasesOverlap(fact, c) || phrasesOverlap(c, fact))) {
    return true;
  }
  if (vec) {
    try {
      const { data: near } = await supabase.rpc('match_cat_forgotten_facts', {
        p_user_id: userId,
        query_embedding: JSON.stringify(vec),
        match_count: 1,
        min_similarity: SUPPRESS_SIMILARITY,
      });
      if (Array.isArray(near) && near.length > 0) {
        return true;
      }
    } catch (err) {
      logger.warn('suppression RPC failed', { err }, 'CatMemory');
    }
  }
  return false;
}

// ─── Explicit remember / edit ────────────────────────────────────────────────

/** What an explicit remember request actually did. */
export interface RememberResult {
  stored: string[];
  /** Facts skipped because an equivalent memory already exists. */
  duplicates: string[];
}

const MAX_REMEMBER_FACTS = 5;

/**
 * Store facts the user EXPLICITLY asked Cat to remember. Unlike passive
 * extraction this is a user command: it clears any matching suppression
 * entries first (a deliberate statement outranks a past deletion), dedupes
 * against existing memories, and reports exactly what happened.
 */
export async function rememberFacts(
  supabase: AnySupabaseClient,
  userId: string,
  facts: string[]
): Promise<RememberResult> {
  const wanted = [...new Set(facts.map(f => f.trim().slice(0, MAX_FACT_CHARS)))]
    .filter(f => f.length >= 3)
    .slice(0, MAX_REMEMBER_FACTS);
  const result: RememberResult = { stored: [], duplicates: [] };
  if (wanted.length === 0) {
    return result;
  }

  // A deliberate "remember this" lifts matching suppressions.
  try {
    const forgotten = await loadForgottenContents(supabase, userId);
    const lifted = forgotten.filter(c => wanted.some(f => phrasesOverlap(f, c)));
    if (lifted.length > 0) {
      await supabase
        .from(DATABASE_TABLES.CAT_FORGOTTEN_FACTS)
        .delete()
        .eq('user_id', userId)
        .in('content', lifted);
    }
  } catch (err) {
    logger.warn('lifting suppressions failed', { err }, 'CatMemory');
  }

  const vectors = embeddingsEnabled() ? await embedTexts(wanted) : wanted.map(() => null);
  const toInsert: Array<{ content: string; embedding: string | null }> = [];
  for (let i = 0; i < wanted.length; i++) {
    const vec = vectors[i];
    if (vec) {
      const { data: near } = await supabase.rpc('match_cat_memories', {
        p_user_id: userId,
        query_embedding: JSON.stringify(vec),
        match_count: 1,
        min_similarity: DEDUP_SIMILARITY,
      });
      if (Array.isArray(near) && near.length > 0) {
        result.duplicates.push(wanted[i]);
        continue;
      }
    }
    toInsert.push({ content: wanted[i], embedding: vec ? JSON.stringify(vec) : null });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from(DATABASE_TABLES.CAT_MEMORIES).insert(
      toInsert.map(m => ({
        user_id: userId,
        content: m.content,
        embedding: m.embedding,
        source: 'user',
        source_conversation_id: null,
      }))
    );
    if (error) {
      logger.warn('rememberFacts insert failed', { error }, 'CatMemory');
      return { stored: [], duplicates: result.duplicates };
    }
    result.stored.push(...toInsert.map(m => m.content));
    await pruneIfNeeded(supabase, userId);
  }
  return result;
}

/** What an edit request actually did. */
export type EditMemoryResult =
  | { ok: true; previous: string; updated: string }
  | { ok: false; reason: 'not_found' | 'ambiguous' | 'failed'; candidates?: string[] };

/**
 * Correct ONE stored memory in place ("it's not 40 CHF, it's 45"). Finds the
 * memory the user means with the same matching rules as forgetting; refuses
 * (with the candidate list) when several match — silently editing the wrong
 * memory is worse than asking the user to be specific.
 */
export async function editMemoryMatching(
  supabase: AnySupabaseClient,
  userId: string,
  match: string,
  newContent: string
): Promise<EditMemoryResult> {
  const wanted = match.trim();
  const updated = newContent.trim().slice(0, MAX_FACT_CHARS);
  if (wanted.length < MIN_FORGET_FRAGMENT_CHARS || updated.length < 3) {
    return { ok: false, reason: 'not_found' };
  }

  const { data: rows, error } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .select('id, content')
    .eq('user_id', userId);
  if (error) {
    return { ok: false, reason: 'failed' };
  }
  const corpus = (rows ?? []) as Array<{ id: string; content: string }>;
  let candidates = corpus.filter(m => phrasesOverlap(wanted, m.content));

  if (candidates.length === 0 && embeddingsEnabled()) {
    try {
      const vec = await embedText(wanted);
      if (vec) {
        const { data: near } = await supabase.rpc('match_cat_memories', {
          p_user_id: userId,
          query_embedding: JSON.stringify(vec),
          match_count: 2,
          min_similarity: FORGET_MATCH_SIMILARITY,
        });
        const nearRows = (Array.isArray(near) ? near : []) as CatMemory[];
        candidates = nearRows.map(n => ({ id: n.id, content: n.content }));
      }
    } catch (err) {
      logger.warn('editMemory semantic match failed', { err }, 'CatMemory');
    }
  }

  if (candidates.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous',
      candidates: candidates.slice(0, 5).map(c => c.content),
    };
  }

  const target = candidates[0];
  const vec = embeddingsEnabled() ? await embedText(updated) : null;
  const { error: updateError } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .update({
      content: updated,
      embedding: vec ? JSON.stringify(vec) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', target.id);
  if (updateError) {
    logger.warn('editMemoryMatching update failed', { error: updateError }, 'CatMemory');
    return { ok: false, reason: 'failed' };
  }
  return { ok: true, previous: target.content, updated };
}

// ─── Extraction ─────────────────────────────────────────────────────────────

// The self-disclosure gate is shared with companion memory —
// src/services/ai/self-disclosure.ts. Re-exported so existing callers and
// tests keep importing it from here.
export { looksLikeSelfDisclosure };

const EXTRACTION_SYSTEM = `You extract durable, user-specific facts worth remembering long-term about a person, from one chat exchange.

Return ONLY a JSON array of short factual statements written in the third person, e.g.:
["Prefers Lightning over on-chain payments", "Building Loki, a life-OS for builders", "Based in Zürich"]

Include ONLY stable facts: preferences, identity, goals, skills, relationships, or constraints that will still be true next week.
EXCLUDE: one-off requests, questions, the assistant's suggestions, transient state, and anything trivial or already obvious.
If there is nothing durable worth remembering, return exactly [].
Return at most ${MAX_FACTS_PER_TURN} facts. No prose, no markdown — just the JSON array.`;

/** Parse the model's reply into a clean list of fact strings (defensive). */
function parseFacts(raw: string): string[] {
  if (!raw) {
    return [];
  }
  // Strip code fences and grab the first JSON array if the model wrapped it.
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim().slice(0, MAX_FACT_CHARS))
      .filter(s => s.length >= 3)
      .slice(0, MAX_FACTS_PER_TURN);
  } catch {
    return [];
  }
}

/**
 * Consent gate: has this user turned memory off? Reads
 * user_ai_preferences.memory_enabled (default true — a missing row or a
 * failed read must never silently disable memory). Only consulted after the
 * cheap guards pass, so it costs one indexed lookup per self-disclosure turn.
 */
export async function memoryConsentGranted(
  supabase: AnySupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from(DATABASE_TABLES.USER_AI_PREFERENCES)
      .select('memory_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    return (data as { memory_enabled?: boolean } | null)?.memory_enabled !== false;
  } catch {
    return true;
  }
}

/**
 * Distil durable facts from one exchange and store the new ones. Best-effort
 * and non-blocking — call without awaiting on the response path. Skips silently
 * when embeddings are off, the message isn't self-disclosure, the user has
 * turned memory off (user_ai_preferences.memory_enabled), or the LLM/DB
 * fails. Dedupes against existing memories by vector similarity.
 */
export async function extractAndStoreMemories(
  supabase: AnySupabaseClient,
  userId: string,
  conversationId: string | null,
  userMessage: string,
  assistantMessage: string,
  aiService: MemoryAiService,
  model: string
): Promise<void> {
  if (!embeddingsEnabled() || !looksLikeSelfDisclosure(userMessage)) {
    return;
  }
  if (!(await memoryConsentGranted(supabase, userId))) {
    return;
  }
  try {
    const { content } = await aiService.chatCompletion({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        {
          role: 'user',
          content: `User said: "${userMessage}"\n\nAssistant replied: "${assistantMessage.slice(0, 800)}"\n\nExtract durable facts about the user as a JSON array.`,
        },
      ],
    });

    const facts = parseFacts(content);
    if (facts.length === 0) {
      return;
    }

    // Embed all candidates in one batch, then dedupe each against what we know.
    const vectors = await embedTexts(facts);
    // One suppression-list read for the whole batch (not per candidate).
    const forgottenContents = await loadForgottenContents(supabase, userId);
    const toInsert: Array<{ content: string; embedding: string }> = [];
    for (let i = 0; i < facts.length; i++) {
      const vec = vectors[i];
      if (!vec) {
        continue;
      }
      // A fact the user explicitly forgot must not be re-learned from old
      // context — that's the suppression contract of forget_memories.
      if (await isSuppressedFact(supabase, userId, facts[i], vec, forgottenContents)) {
        continue;
      }
      const { data: near } = await supabase.rpc('match_cat_memories', {
        p_user_id: userId,
        query_embedding: JSON.stringify(vec),
        match_count: 1,
        min_similarity: DEDUP_SIMILARITY,
      });
      if (Array.isArray(near) && near.length > 0) {
        continue; // already remember something equivalent
      }
      toInsert.push({ content: facts[i], embedding: JSON.stringify(vec) });
    }

    if (toInsert.length === 0) {
      return;
    }

    const { error } = await supabase.from(DATABASE_TABLES.CAT_MEMORIES).insert(
      toInsert.map(m => ({
        user_id: userId,
        content: m.content,
        embedding: m.embedding,
        source: 'chat',
        source_conversation_id: conversationId,
      }))
    );
    if (error) {
      logger.warn('Failed to insert cat memories', { error }, 'CatMemory');
      return;
    }

    await pruneIfNeeded(supabase, userId);
  } catch (err) {
    logger.warn('extractAndStoreMemories threw', { err }, 'CatMemory');
  }
}

/**
 * Keep the corpus bounded: delete the oldest memories beyond the per-user cap.
 *
 * The delete is scoped by user_id as well as by id. That is redundant today —
 * the ids come from a query already filtered to this user, run through an
 * RLS-scoped client — and it is exactly the redundancy worth having: this is an
 * unconditional DELETE of rows the user never asked to remove, and the only
 * thing standing between it and someone else's memories is that both of those
 * conditions keep holding. Hand it a service-role client one day, as three
 * other paths in this service already use, and RLS stops being the backstop.
 *
 * Every other delete in this file is written that way, including the
 * suppression-lifting one twenty lines above. bitbaum/orangecat#563 finding 13.
 */
async function pruneIfNeeded(supabase: AnySupabaseClient, userId: string): Promise<void> {
  const { count } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (!count || count <= MAX_MEMORIES_PER_USER) {
    return;
  }
  const { data: oldest } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(count - MAX_MEMORIES_PER_USER);
  const ids = (oldest as Array<{ id: string }> | null)?.map(r => r.id) ?? [];
  if (ids.length > 0) {
    await supabase.from(DATABASE_TABLES.CAT_MEMORIES).delete().eq('user_id', userId).in('id', ids);
  }
}

// ─── Management (list / delete) ───────────────────────────────────────────────

/** A load either succeeds with memories or fails — never conflate the two. */
export type ListMemoriesResult = { ok: true; memories: CatMemory[] } | { ok: false; error: string };

/**
 * List a user's memories, newest first, distinguishing "genuinely empty" from
 * "query failed" so a caller at a UI boundary can show a real error instead of
 * a misleading "no memories yet" empty state.
 */
export async function listMemoriesResult(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ListMemoriesResult> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .select('id, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_MEMORIES_PER_USER);
  if (error) {
    logger.warn('listMemories failed', { error }, 'CatMemory');
    return { ok: false, error: error.message };
  }
  return { ok: true, memories: (data ?? []) as CatMemory[] };
}

/**
 * Convenience wrapper for grounding callers (offer/writing context) that
 * legitimately degrade to an empty list on failure — they only feed the model
 * "(none)". UI boundaries should use listMemoriesResult to surface real errors.
 */
export async function listMemories(
  supabase: AnySupabaseClient,
  userId: string
): Promise<CatMemory[]> {
  const result = await listMemoriesResult(supabase, userId);
  return result.ok ? result.memories : [];
}

/** Delete one memory the user owns. RLS guarantees cross-user safety. */
export async function deleteMemory(
  supabase: AnySupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    logger.warn('deleteMemory failed', { error }, 'CatMemory');
    return false;
  }
  return true;
}

/** Forget everything Cat remembers about the user. */
export async function deleteAllMemories(
  supabase: AnySupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .delete()
    .eq('user_id', userId);
  if (error) {
    logger.warn('deleteAllMemories failed', { error }, 'CatMemory');
    return false;
  }
  return true;
}

// ─── Import (bring memory from another AI) ─────────────────────────────────────
// Turning the paste into facts is memory-import-parse.ts; storing them is here.

/** Batch size for embedding many candidates without oversized requests. */
const IMPORT_EMBED_BATCH = 100;

export interface MemoryImportResult {
  /** Candidate facts found in the pasted text. */
  total: number;
  /** Newly stored (after dedup). */
  imported: number;
  /** Dropped because an equivalent memory already existed. */
  skipped: number;
  /** False when no embeddings provider is configured — imported facts are stored
   *  but won't be recalled semantically until one is set. */
  embeddingsEnabled: boolean;
}

/**
 * Import durable facts from a memory export the user pasted from another AI.
 * Embeds each (for recall + dedup), skips ones already equivalent to a stored
 * memory, inserts the rest as `source: 'import'`, and prunes to the per-user cap.
 * Degrades gracefully: with no embeddings provider, facts are still stored
 * (embeddingsEnabled=false in the result) but can't be recalled by meaning yet.
 */
export async function importMemories(
  supabase: AnySupabaseClient,
  userId: string,
  rawText: string
): Promise<MemoryImportResult> {
  const facts = parseImportedMemories(rawText);
  const useEmbeddings = embeddingsEnabled();
  const result: MemoryImportResult = {
    total: facts.length,
    imported: 0,
    skipped: 0,
    embeddingsEnabled: useEmbeddings,
  };
  if (facts.length === 0) {
    return result;
  }

  // Exact-content dedup against what's already stored. Semantic dedup below
  // catches near-duplicates, but only when embeddings are on — this keeps the
  // "skips what it already knows" promise true even with no provider, and makes
  // re-importing the same paste a safe no-op.
  const { data: existingRows } = await supabase
    .from(DATABASE_TABLES.CAT_MEMORIES)
    .select('content')
    .eq('user_id', userId)
    .limit(MAX_MEMORIES_PER_USER);
  const existing = new Set<string>(
    ((existingRows as Array<{ content: string }> | null) ?? []).map(r =>
      r.content.trim().toLowerCase()
    )
  );

  const vectors: (number[] | null)[] = [];
  if (useEmbeddings) {
    for (let i = 0; i < facts.length; i += IMPORT_EMBED_BATCH) {
      vectors.push(...(await embedTexts(facts.slice(i, i + IMPORT_EMBED_BATCH))));
    }
  } else {
    for (let i = 0; i < facts.length; i++) {
      vectors.push(null);
    }
  }

  const toInsert: Array<{
    user_id: string;
    content: string;
    embedding: string | null;
    source: string;
    source_conversation_id: null;
  }> = [];
  for (let i = 0; i < facts.length; i++) {
    const exactKey = facts[i].trim().toLowerCase();
    if (existing.has(exactKey)) {
      result.skipped++;
      continue; // already stored verbatim
    }
    const vec = vectors[i];
    if (vec) {
      const { data: near } = await supabase.rpc('match_cat_memories', {
        p_user_id: userId,
        query_embedding: JSON.stringify(vec),
        match_count: 1,
        min_similarity: DEDUP_SIMILARITY,
      });
      if (Array.isArray(near) && near.length > 0) {
        result.skipped++;
        continue; // already remember something equivalent
      }
    }
    // Guard against exact dupes within this same paste when embeddings are off.
    existing.add(exactKey);
    toInsert.push({
      user_id: userId,
      content: facts[i],
      embedding: vec ? JSON.stringify(vec) : null,
      source: 'import',
      source_conversation_id: null,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from(DATABASE_TABLES.CAT_MEMORIES).insert(toInsert);
    if (error) {
      logger.warn('Failed to insert imported cat memories', { error }, 'CatMemory');
      return result;
    }
    result.imported = toInsert.length;
    await pruneIfNeeded(supabase, userId);
  }
  return result;
}
