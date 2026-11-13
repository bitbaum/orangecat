/**
 * Persisting a message, with authorization already decided elsewhere.
 *
 * Extracted from `sendMessage`, which does two separable things: it decides
 * whether the caller may speak as `senderId` — requiring a signed-in user whose
 * id matches — and then it writes. Those are different concerns, and conflating
 * them meant there was no way for a sender that is not a browser session to
 * write at all.
 *
 * The Cat is exactly that sender. It answers from a cron worker with no session,
 * so calling `sendMessage` threw `Unauthorized` and its reply was lost — found
 * by running the real path against production, not by any unit test, because a
 * mocked client has no opinion about sessions.
 *
 * The fix is NOT to relax `sendMessage`. Its "sender must match the
 * authenticated user" check is a real control on the human path and stays
 * exactly as it was; it now delegates the writing half to this. A caller
 * reaching this function is asserting that authorization has already happened —
 * which is why it takes an admin client explicitly rather than making one.
 */

import { fromTable } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WriteMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type?: string;
  metadata?: Record<string, unknown> | null;
  senderActorId?: string | null;
  /** What the conversation list shows for a message with no words (one of
   *  only files): "Photo", "2 photos". Defaults to the words. */
  preview?: string;
}

/**
 * @returns the new message id.
 * @throws when the message itself cannot be stored. The two follow-up writes
 *   are best-effort: a conversation whose preview is stale is a cosmetic
 *   problem, while a message that was never written is a lost one.
 */
export async function writeMessage(
  admin: SupabaseClient,
  input: WriteMessageInput
): Promise<string> {
  const { conversationId, senderId, content } = input;

  const messageData: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    message_type: input.type ?? 'text',
    metadata: (input.metadata || {}) as Json,
  };
  if (input.senderActorId) {
    messageData.sender_actor_id = input.senderActorId;
  }

  const { data: message, error: insertError } = await fromTable(admin, DATABASE_TABLES.MESSAGES)
    .insert(messageData)
    .select('id')
    .single();

  if (insertError || !message) {
    logger.error('Error inserting message:', insertError);
    throw Object.assign(new Error('Failed to send message'), { status: 500 });
  }

  // Without this the conversation list still shows the previous message as the
  // latest, so a reply that was written looks like it never arrived.
  const { error: updateError } = await fromTable(admin, DATABASE_TABLES.CONVERSATIONS)
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: (content || input.preview || '').substring(0, 100),
      last_message_sender_id: senderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    logger.warn('Failed to update conversation metadata:', updateError);
  }

  // Your own message is read by definition.
  const { error: readError } = await fromTable(admin, DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', senderId);

  if (readError) {
    logger.warn('Failed to update sender read time:', readError);
  }

  return message.id as string;
}
