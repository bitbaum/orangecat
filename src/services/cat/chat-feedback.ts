/**
 * A thumb under a Cat answer (the fleet chat-review loop, chatkit 0.14).
 *
 * The thread draws the thumbs (chatkit's AnswerActions); the app receives
 * `{ messageId, verdict, reason?, text? }` and posts it to
 * POST /api/chat/feedback, which lands here. The row is kept with the
 * conversation so the nightly reviewer (GET /api/chat/review-export) reads
 * the person's own verdict beside the transcript.
 */

import { z } from 'zod';
import { FEEDBACK_REASONS } from '@bitbaum/chatkit';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { resolveOwnedConversationId } from '@/services/cat/conversation-history';

export const chatFeedbackSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().min(1).max(100),
  verdict: z.enum(['up', 'down']),
  reason: z.enum(FEEDBACK_REASONS).optional(),
  text: z.string().trim().min(1).max(1000).optional(),
});
export type ChatFeedbackInput = z.infer<typeof chatFeedbackSchema>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The stored id for the answer a thumb was given on.
 *
 * A message loaded from history carries its row id. An answer still on the
 * screen from this session carries the client's own id for the turn
 * (`assistant-<time>`): the row is written after the stream closes, and the
 * thread never learns its id. A thumb on such an answer is a thumb on the
 * conversation's newest stored answer — the one that just arrived — so that
 * is what it resolves to. When nothing resolves, the id is kept as given:
 * the verdict still reaches the reviewer, under the product's own id.
 */
export async function resolveFeedbackMessageId(
  supabase: AnySupabaseClient,
  conversationId: string,
  messageId: string
): Promise<string> {
  if (UUID.test(messageId)) {
    const { data } = await supabase
      .from(DATABASE_TABLES.CAT_MESSAGES)
      .select('id')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (data?.id) {
      return data.id;
    }
  }
  const { data: latest } = await supabase
    .from(DATABASE_TABLES.CAT_MESSAGES)
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return latest?.id ?? messageId;
}

export type RecordFeedbackResult =
  { ok: true; messageId: string } | { ok: false; reason: 'not_found' };

/** Keep one verdict with the person's conversation; a foreign id is "not found". */
export async function recordChatFeedback(
  supabase: AnySupabaseClient,
  userId: string,
  input: ChatFeedbackInput
): Promise<RecordFeedbackResult> {
  const owned = await resolveOwnedConversationId(supabase, userId, input.conversationId);
  if (!owned) {
    return { ok: false, reason: 'not_found' };
  }
  const messageId = await resolveFeedbackMessageId(supabase, owned, input.messageId);
  const { error } = await supabase.from(DATABASE_TABLES.CHAT_FEEDBACK).insert({
    conversation_id: owned,
    message_id: messageId,
    verdict: input.verdict,
    reason: input.reason ?? null,
    text: input.text ?? null,
  });
  if (error) {
    throw error;
  }
  return { ok: true, messageId };
}
