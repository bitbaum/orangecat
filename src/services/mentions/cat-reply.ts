/**
 * Answering a mention in a private conversation.
 *
 * "@cat what do you think about this?" is the question worth supporting, and
 * the whole difficulty is the word "this": it means the conversation, not the
 * sentence. So the Cat reads a recent window of the thread and answers there,
 * as itself, in a message row like anyone else's.
 *
 * SCOPE OF THE READ is a product promise, not an implementation detail. The Cat
 * sees CAT_CONTEXT_MESSAGE_WINDOW recent messages of the conversation it was
 * tagged in, and nothing else — no other conversation, no history beyond the
 * window. Tagging is the consent, and it is consent to this much.
 */

import { CAT_CONTEXT_MESSAGE_WINDOW, CAT_DISPLAY_NAME, CAT_MENTION } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';
import { isAloneWithCat } from '@/services/mentions/cat-direct';
import { writeMessage } from '@/features/messaging/server/write-message';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

/** What the Cat says when it cannot answer. Never silence — see below. */
export const CAT_FALLBACK_REPLY =
  "I couldn't work that one out just now — ask me again in a moment?";

/** What the Cat is told: tagged in other people's conversation, or written to directly. */
export function systemPrompt(direct: boolean): string {
  return [
    direct
      ? `You are ${CAT_DISPLAY_NAME}, the OrangeCat agent, in a conversation between you and one person.`
      : `You are ${CAT_DISPLAY_NAME}, the OrangeCat agent, replying inside someone's private conversation.`,
    direct
      ? 'Every message here is written to you. Answer their newest message, using the conversation for context.'
      : `You were tagged with ${CAT_MENTION}. Answer the question that was asked of you, using the conversation for context.`,
    'Be brief and concrete — this is a chat, not an essay. Two or three sentences unless asked for more.',
    'Never repeat the conversation back to them. Never mention that you are an AI model.',
    'If the question needs information you do not have, say so plainly and say what would answer it.',
    'Respond as JSON: {"reply": "<your message>"}',
  ].join('\n');
}

export interface ConversationMessage {
  sender_id: string;
  content: string;
  created_at: string;
}

/**
 * Read the window the Cat is allowed to see, oldest-first for the prompt.
 */
export async function loadConversationContext(
  admin: SupabaseClient,
  conversationId: string
): Promise<ConversationMessage[]> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.MESSAGES)
    .select('sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(CAT_CONTEXT_MESSAGE_WINDOW);

  if (error || !data) {
    return [];
  }
  return (data as ConversationMessage[]).slice().reverse();
}

/** Render the window as a transcript, naming only the person who asked. */
export function buildPrompt(
  messages: ConversationMessage[],
  requesterId: string,
  catId: string,
  direct = false
): string {
  const lines = messages.map(m => {
    const who =
      m.sender_id === catId
        ? CAT_DISPLAY_NAME
        : m.sender_id === requesterId
          ? 'They'
          : 'Someone else';
    return `${who}: ${m.content}`;
  });
  return [
    'Conversation so far (oldest first):',
    lines.join('\n'),
    '',
    direct
      ? 'Reply to their most recent message.'
      : `Reply to the most recent message that tagged ${CAT_MENTION}.`,
  ].join('\n');
}

/**
 * Produce and post the Cat's answer.
 *
 * @returns true when a message was written. A failure to think is still
 *   answered — see CAT_FALLBACK_REPLY — because a tag that produces silence is
 *   indistinguishable from a broken feature, and this codebase has shipped that
 *   exact failure before.
 */
export async function replyToConversationMention(
  admin: SupabaseClient,
  params: { conversationId: string; requesterId: string; catId: string }
): Promise<boolean> {
  const { conversationId, requesterId, catId } = params;

  const context = await loadConversationContext(admin, conversationId);
  if (context.length === 0) {
    logger.warn('Cat tagged in a conversation it cannot read', { conversationId }, 'CatReply');
    return false;
  }

  // Alone with the person, nothing tagged it: every message is for the Cat.
  const direct = await isAloneWithCat(admin, conversationId, requesterId).catch(() => false);

  let reply = '';
  try {
    const raw = await callPlatformJson(
      systemPrompt(direct),
      buildPrompt(context, requesterId, catId, direct),
      { timeoutMs: 30_000 }
    );
    const parsed = parseJsonLoose<{ reply?: string }>(raw);
    reply = (parsed?.reply ?? '').trim();
  } catch (error) {
    logger.error(
      'Cat reply generation failed',
      { conversationId, error: error instanceof Error ? error.message : String(error) },
      'CatReply'
    );
  }

  if (!reply) {
    reply = CAT_FALLBACK_REPLY;
  }

  await ensureCatIsParticipant(admin, conversationId, catId);
  // writeMessage, not sendMessage: the latter requires a signed-in user whose id
  // matches the sender, which is right for a person and impossible for a worker.
  // Going through it threw Unauthorized and the reply was silently lost.
  await writeMessage(admin, {
    conversationId,
    senderId: catId,
    content: reply,
    // `requested_by`: an agent's words are never unattributed in a shared
    // room — the thread shows "Cat · for <the person who tagged it>". Alone
    // with one person there is nobody else it could have answered for.
    metadata: direct ? { is_cat_reply: true } : { is_cat_reply: true, requested_by: requesterId },
  });
  return true;
}

/**
 * Add the Cat to the conversation it was tagged in.
 *
 * It STAYS rather than answering and leaving, so a follow-up needs no second
 * tag and both people can see it is present — a participant row is what makes
 * the Cat visible in the header rather than a voice from nowhere. Anyone can
 * remove it the same way they would remove a person.
 */
async function ensureCatIsParticipant(
  admin: SupabaseClient,
  conversationId: string,
  catId: string
): Promise<void> {
  const { error } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .upsert(
      { conversation_id: conversationId, user_id: catId, is_active: true },
      { onConflict: 'conversation_id,user_id' }
    );
  if (error) {
    // Not fatal: the message is written by the service role either way, and a
    // Cat that speaks without a participant row is better than one that stays
    // silent because bookkeeping failed.
    logger.warn(
      'Could not add the Cat as a participant',
      { conversationId, error: error.message },
      'CatReply'
    );
  }
}
