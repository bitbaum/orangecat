/**
 * A bot answers in Messages (ADR-0015, D3 and D4).
 *
 * Separate from ./bot-seats.ts because this file reaches a model and that one
 * must not: only the send route imports this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CAT_CONTEXT_MESSAGE_WINDOW } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import { companionAnswer } from '@/services/companions/answer';
import { logger } from '@/utils/logger';
import { seatsOfAccounts } from './bot-seats';
import { writeMessage } from './write-message';

/** What a bot says when it could not answer. Never silence: a message that
 *  gets nothing back cannot be told from a broken feature. */
export const BOT_FALLBACK_REPLY = 'I could not answer that just now. Send it again in a moment.';

/** The scene a companion is told when it sits in a conversation in Messages. */
export function messagesScene(definition: string | undefined): string {
  return [
    definition?.trim() ?? '',
    'You are in a direct conversation with one person in OrangeCat Messages.',
    'Answer as yourself, in the first person. This is a chat: be brief unless asked for more.',
    'Plain text only. Do not write a name or a label in front of your answer.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * A conversation's window as a transcript for the bot: its own lines are the
 * assistant's, everyone else's the user's. Messages of only files read as
 * what they are, so the bot is not handed an empty line.
 */
export function transcriptForSeat(
  messages: ReadonlyArray<{ sender_id: string; content: string | null }>,
  seatUserId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .map(m => ({
      role: m.sender_id === seatUserId ? ('assistant' as const) : ('user' as const),
      content: (m.content ?? '').trim(),
    }))
    .filter(line => line.content.length > 0);
}

/**
 * The bot a message is owed an answer from: the one other member of a
 * conversation of two, when that member is a seat (ADR-0015 D3). Groups wait
 * for the build order's step 3.
 */
async function botOwedAnAnswer(
  admin: SupabaseClient,
  conversationId: string,
  senderId: string
): Promise<{ assistantId: string | null; userId: string } | null> {
  const { data } = await fromTable(admin, DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('is_active', true);
  const others = ((data ?? []) as Array<{ user_id: string }>)
    .map(p => p.user_id)
    .filter(id => id !== senderId);
  if (others.length !== 1) {
    return null;
  }
  const seatUserId = others[0]!;
  const seats = await seatsOfAccounts(admin, [seatUserId]);
  if (!seats.has(seatUserId)) {
    return null;
  }
  return { assistantId: seats.get(seatUserId) ?? null, userId: seatUserId };
}

/**
 * Answer a message a person just sent to a bot, if it is owed one.
 *
 * Runs after the person's message is stored and their request has been
 * answered. On the asker's own key or their free allowance, at the
 * companion's price (ADR-0015 D4). A failure to think is still answered, in
 * words: a limit reached says so with its way out, anything else is the
 * fallback line.
 *
 * @returns true when a message was written.
 */
export async function answerAsBot(
  admin: SupabaseClient,
  params: { conversationId: string; senderId: string }
): Promise<boolean> {
  const { conversationId, senderId } = params;
  try {
    const seat = await botOwedAnAnswer(admin, conversationId, senderId);
    if (!seat) {
      return false;
    }
    const { data: profile } = await fromTable(admin, DATABASE_TABLES.PROFILES)
      .select('name')
      .eq('id', seat.userId)
      .maybeSingle();
    const name = (profile as { name: string | null } | null)?.name || 'The bot';

    const { data: rows } = await fromTable(admin, DATABASE_TABLES.MESSAGES)
      .select('sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(CAT_CONTEXT_MESSAGE_WINDOW);
    const transcript = transcriptForSeat(
      ((rows ?? []) as Array<{ sender_id: string; content: string | null }>).slice().reverse(),
      seat.userId
    );
    const last = transcript[transcript.length - 1];
    if (!last || last.role !== 'user') {
      // Only files, or nothing to answer.
      return false;
    }

    let reply = '';
    let settle: ((messageId: string) => Promise<void>) | null = null;
    const answer = !seat.assistantId
      ? // Its companion was deleted: say so, once per message, in its place.
        { error: { code: 'NOT_FOUND' as const, message: `${name} is not here any more.` } }
      : await companionAnswer({
          supabase: admin,
          userId: senderId,
          assistantId: seat.assistantId,
          name,
          history: transcript.slice(0, -1),
          content: last.content,
          scene: messagesScene,
        });
    if ('error' in answer) {
      reply =
        'message' in answer.error && answer.error.message
          ? answer.error.message
          : answer.error.code === 'INSUFFICIENT_CREDITS'
            ? `${name} charges per message and your Cat Credits do not cover this one.`
            : BOT_FALLBACK_REPLY;
      logger.warn(
        'A bot could not answer',
        { conversationId, code: answer.error.code },
        'BotSeats'
      );
    } else {
      reply = answer.content.trim() || BOT_FALLBACK_REPLY;
      settle = answer.settle;
    }

    const messageId = await writeMessage(admin, {
      conversationId,
      senderId: seat.userId,
      content: reply,
      metadata: { is_bot_reply: true },
    });
    if (settle) {
      await settle(messageId);
    }
    return true;
  } catch (error) {
    logger.error(
      'Bot answer failed',
      { conversationId, error: error instanceof Error ? error.message : String(error) },
      'BotSeats'
    );
    return false;
  }
}
