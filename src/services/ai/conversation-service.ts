/**
 * AI conversation domain logic (server-only).
 *
 * Read-with-messages, owner-scoped update, and delete for AI assistant
 * conversations. Kept out of the API route so it stays a thin
 * validate → delegate → respond wrapper. Every query is scoped by
 * (conversation id, assistant id, user id) so a caller can only reach their
 * own rows. Each function returns a discriminated result the route maps to an
 * HTTP response (no HTTP concerns in this layer).
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** Outcome code the route maps to apiNotFound. */
export type ConversationErrorCode = 'not_found';

export type ConversationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ConversationErrorCode; message: string }
  | { ok: false; dbError: unknown; message: string };

/** Fetch a conversation (scoped to the owner) with its messages and assistant summary. */
export async function getConversationDetail(
  supabase: AnySupabaseClient,
  assistantId: string,
  convId: string,
  userId: string
): Promise<ConversationResult<Record<string, unknown>>> {
  const { data: conversation, error: convError } = await supabase
    .from(DATABASE_TABLES.AI_CONVERSATIONS)
    .select('*')
    .eq('id', convId)
    .eq('assistant_id', assistantId)
    .eq('user_id', userId)
    .single();

  if (convError || !conversation) {
    return { ok: false, code: 'not_found', message: 'Conversation not found' };
  }

  const [{ data: messages, error: msgError }, { data: assistant }] = await Promise.all([
    supabase
      .from(DATABASE_TABLES.AI_MESSAGES)
      .select('*')
      .eq('conversation_id', convId)
      .neq('role', 'system')
      .order('created_at', { ascending: true }),
    supabase
      .from(DATABASE_TABLES.AI_ASSISTANTS)
      .select('id, title, avatar_url, pricing_model, price_per_message, price_per_1k_tokens')
      .eq('id', assistantId)
      .single(),
  ]);

  if (msgError) {
    logger.error('Error fetching messages', msgError, 'AIConversationAPI');
    return { ok: false, dbError: msgError, message: 'Failed to fetch messages' };
  }

  return {
    ok: true,
    data: {
      ...(conversation as Record<string, unknown>),
      messages: messages || [],
      assistant,
    },
  };
}

/** Update the owner's conversation (title and/or status). */
export async function updateConversation(
  supabase: AnySupabaseClient,
  assistantId: string,
  convId: string,
  userId: string,
  patch: Record<string, unknown>
): Promise<ConversationResult<Record<string, unknown>>> {
  const { data: conversation, error } = await supabase
    .from(DATABASE_TABLES.AI_CONVERSATIONS)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', convId)
    .eq('assistant_id', assistantId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating conversation', error, 'AIConversationAPI');
    return { ok: false, dbError: error, message: 'Failed to update conversation' };
  }
  if (!conversation) {
    return { ok: false, code: 'not_found', message: 'Conversation not found' };
  }

  return { ok: true, data: conversation as Record<string, unknown> };
}

/** Delete the owner's conversation. */
export async function deleteConversation(
  supabase: AnySupabaseClient,
  assistantId: string,
  convId: string,
  userId: string
): Promise<ConversationResult<{ message: string }>> {
  const { error } = await supabase
    .from(DATABASE_TABLES.AI_CONVERSATIONS)
    .delete()
    .eq('id', convId)
    .eq('assistant_id', assistantId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Error deleting conversation', error, 'AIConversationAPI');
    return { ok: false, dbError: error, message: 'Failed to delete conversation' };
  }

  return { ok: true, data: { message: 'Conversation deleted' } };
}
