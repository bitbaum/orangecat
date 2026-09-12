/**
 * Cat Conversation History Service
 *
 * Manages persistent chat history for My Cat AI. Supports multiple named
 * conversations per user (Grok/ChatGPT-style), plus a default one used when no
 * conversation is specified (back-compat with the single-thread UI).
 *
 * Design:
 * - Many conversations per user; one flagged is_default
 * - Last N messages of the ACTIVE conversation injected into LLM context
 * - Messages saved after each exchange (non-blocking on the response path)
 * - A conversation's title is auto-set from its first user message
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';

// Type alias that accepts any typed Supabase client (avoids schema mismatch errors)

/** Max messages to inject into LLM context (10 turns = 20 messages) */
const HISTORY_INJECTION_LIMIT = 20;

/** Max messages to return for UI history display */
const HISTORY_DISPLAY_LIMIT = 50;

/** Max length of an auto-generated conversation title. */
const TITLE_MAX_LENGTH = 60;

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used?: string | null;
  provider?: string | null;
  token_count?: number | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  is_default: boolean;
  updated_at: string;
}

/**
 * Gets or creates the user's default conversation.
 * Returns the conversation ID.
 */
export async function getOrCreateDefaultConversation(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string> {
  // Try to get existing default conversation
  const { data: existing } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new default conversation
  const { data: created, error } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .insert({ user_id: userId, is_default: true })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create conversation: ${error?.message}`);
  }

  return created.id;
}

/**
 * Resolve the conversation to operate on: the requested one (if it exists and
 * belongs to the user), otherwise null so callers can fall back to the default.
 * Guards against acting on another user's conversation id.
 */
export async function resolveOwnedConversationId(
  supabase: AnySupabaseClient,
  userId: string,
  conversationId?: string | null
): Promise<string | null> {
  if (!conversationId) {
    return null;
  }
  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();
  return data?.id ?? null;
}

/**
 * Resolve to a usable conversation id: the requested+owned one, else the default
 * (created on demand). Use on the write path so a message always lands somewhere.
 */
export async function resolveConversationIdOrDefault(
  supabase: AnySupabaseClient,
  userId: string,
  conversationId?: string | null
): Promise<string> {
  const owned = await resolveOwnedConversationId(supabase, userId, conversationId);
  return owned ?? (await getOrCreateDefaultConversation(supabase, userId));
}

/** List the user's conversations, most-recently-updated first. */
export async function listConversations(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ConversationSummary[]> {
  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .select('id, title, is_default, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  return (data as ConversationSummary[]) ?? [];
}

/** Create a fresh (non-default) conversation and return its id. */
export async function createConversation(
  supabase: AnySupabaseClient,
  userId: string,
  title?: string | null
): Promise<string> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .insert({ user_id: userId, is_default: false, title: title ?? null })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Failed to create conversation: ${error?.message}`);
  }
  return data.id;
}

/** Delete a conversation (and its messages) the user owns. Returns success. */
export async function deleteConversation(
  supabase: AnySupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const owned = await resolveOwnedConversationId(supabase, userId, conversationId);
  if (!owned) {
    return false;
  }
  await supabase.from(DATABASE_TABLES.CAT_MESSAGES).delete().eq('conversation_id', owned);
  const { error } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .delete()
    .eq('id', owned)
    .eq('user_id', userId);
  return !error;
}

/**
 * Delete ALL of a user's Cat conversations (data-controls "delete all").
 * Deleting the cat_conversations rows is sufficient — cat_messages has
 * ON DELETE CASCADE on conversation_id, so messages go with them. Returns
 * success.
 */
export async function deleteAllConversations(
  supabase: AnySupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .delete()
    .eq('user_id', userId);
  return !error;
}

/**
 * Saves a batch of messages to a conversation.
 * Used to save user + assistant message pair after each exchange.
 */
/**
 * How much of a turn's tool activity is worth keeping.
 *
 * A chip's `results` carry every search hit with its title and url, so an
 * unbounded write puts an entire web-search page into a chat row — on every
 * turn, forever. These caps keep a turn's record to something a message row can
 * hold while preserving what the chips actually render: which tools ran, what
 * they did, and enough results for the expansion and the citations.
 */
const MAX_STORED_TOOL_CALLS = 12;
const MAX_STORED_RESULTS_PER_CALL = 8;

/** Trim a turn's tool calls to what is worth persisting. */
export function trimToolCallsForStorage(toolCalls: unknown): unknown[] | null {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return null;
  }
  return toolCalls.slice(0, MAX_STORED_TOOL_CALLS).map(call => {
    if (!call || typeof call !== 'object') {
      return call;
    }
    const c = call as Record<string, unknown>;
    if (!Array.isArray(c.results)) {
      return c;
    }
    return { ...c, results: c.results.slice(0, MAX_STORED_RESULTS_PER_CALL) };
  });
}

export async function saveMessages(
  supabase: AnySupabaseClient,
  conversationId: string,
  userId: string,
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    model_used?: string;
    provider?: string;
    token_count?: number;
    /** What Cat did this turn, so a reloaded thread can still show it. */
    tool_calls?: unknown[];
  }>
): Promise<void> {
  const rows = messages.map(m => ({
    conversation_id: conversationId,
    user_id: userId,
    role: m.role,
    content: m.content,
    model_used: m.model_used ?? null,
    provider: m.provider ?? null,
    token_count: m.token_count ?? null,
    tool_calls: trimToolCallsForStorage(m.tool_calls),
  }));

  await supabase.from(DATABASE_TABLES.CAT_MESSAGES).insert(rows);
  // Ignore errors — history is best-effort, never blocks responses

  // Keep the conversation fresh for rail ordering, and name an untitled
  // conversation from its first user message (Grok/ChatGPT behaviour).
  const firstUser = messages.find(m => m.role === 'user')?.content;
  await bumpConversation(supabase, conversationId, firstUser);
}

/**
 * Touch a conversation's updated_at (for recency ordering) and, if it has no
 * title yet, set it from the given text. Best-effort.
 */
export async function bumpConversation(
  supabase: AnySupabaseClient,
  conversationId: string,
  titleFrom?: string
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const title = titleFrom?.trim();
  if (title) {
    const { data: row } = await supabase
      .from(DATABASE_TABLES.CAT_CONVERSATIONS)
      .select('title')
      .eq('id', conversationId)
      .single();
    if (row && !row.title) {
      patch.title =
        title.length > TITLE_MAX_LENGTH ? `${title.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : title;
    }
  }
  await supabase.from(DATABASE_TABLES.CAT_CONVERSATIONS).update(patch).eq('id', conversationId);
}

/**
 * Fetches recent messages for LLM context injection.
 * Returns messages in chronological order (oldest first).
 */
export async function getMessagesForContext(
  supabase: AnySupabaseClient,
  userId: string,
  conversationIdArg?: string | null,
  limit: number = HISTORY_INJECTION_LIMIT
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const conversationId =
    (await resolveOwnedConversationId(supabase, userId, conversationIdArg)) ??
    (await getDefaultConversationId(supabase, userId));
  if (!conversationId) {
    return [];
  }

  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_MESSAGES)
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) {
    return [];
  }

  // Reverse to get chronological order for LLM
  return (data as Array<{ role: 'user' | 'assistant'; content: string }>).reverse();
}

/**
 * Fetches recent messages for UI display.
 * Returns in chronological order with full metadata.
 */
export async function getMessagesForDisplay(
  supabase: AnySupabaseClient,
  userId: string,
  conversationIdArg?: string | null,
  limit: number = HISTORY_DISPLAY_LIMIT
): Promise<StoredMessage[]> {
  const conversationId =
    (await resolveOwnedConversationId(supabase, userId, conversationIdArg)) ??
    (await getDefaultConversationId(supabase, userId));
  if (!conversationId) {
    return [];
  }

  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_MESSAGES)
    .select('id, role, content, model_used, provider, token_count, tool_calls, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) {
    return [];
  }

  return (data as StoredMessage[]).reverse();
}

/**
 * Deletes all messages in a conversation (clear chat). Defaults to the user's
 * default conversation when none is given.
 */
export async function clearDefaultConversation(
  supabase: AnySupabaseClient,
  userId: string,
  conversationIdArg?: string | null
): Promise<void> {
  const conversationId =
    (await resolveOwnedConversationId(supabase, userId, conversationIdArg)) ??
    (await getDefaultConversationId(supabase, userId));
  if (!conversationId) {
    return;
  }

  await supabase.from(DATABASE_TABLES.CAT_MESSAGES).delete().eq('conversation_id', conversationId);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function getDefaultConversationId(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  return data?.id ?? null;
}
