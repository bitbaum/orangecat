/**
 * A bot answers in Messages (ADR-0015, D3 and D4).
 *
 * Separate from ./bot-seats.ts because this file reaches a model and that one
 * must not: only the send route imports this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CAT_CONTEXT_MESSAGE_WINDOW } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createAdminClient } from '@/lib/supabase/admin';
import { fromTable } from '@/lib/supabase/untyped';
import { decideConversationAccess } from '@/services/companions/access';
import { companionAnswer } from '@/services/companions/answer';
import { logger } from '@/utils/logger';
import { namedBots } from '../lib/named-bots';
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

/** The scene for a conversation of several people, where a bot was named. */
export function groupScene(
  definition: string | undefined,
  about: { name: string; asker: string; others: readonly string[] }
): string {
  return [
    definition?.trim() ?? '',
    `You are ${about.name}, in a group conversation in OrangeCat Messages with ${about.others.join(', ')}.`,
    `${about.asker} named you in the newest message. Answer ${about.asker}; the others read it too.`,
    'Each line of the conversation starts with the name of who wrote it.',
    'Speak only as yourself, in the first person, briefly. Never write a line for anybody else.',
    'Plain text only. Do not write your own name or a label in front of your answer.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * A conversation's window as a transcript for the bot: its own lines are the
 * assistant's, everyone else's the user's. Messages of only files read as
 * what they are, so the bot is not handed an empty line.
 *
 * With `names`, every line that is not the bot's own starts with who wrote
 * it: in a group the bot has to know which person said what.
 */
export function transcriptForSeat(
  messages: ReadonlyArray<{ sender_id: string; content: string | null }>,
  seatUserId: string,
  names?: ReadonlyMap<string, string>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .map(m => {
      const words = (m.content ?? '').trim();
      const own = m.sender_id === seatUserId;
      return {
        role: own ? ('assistant' as const) : ('user' as const),
        content:
          !own && names && words ? `${names.get(m.sender_id) ?? 'Someone'}: ${words}` : words,
      };
    })
    .filter(line => line.content.length > 0);
}

interface Seat {
  userId: string;
  /** Null once the companion was deleted. */
  assistantId: string | null;
  name: string;
  /** When it was added: a bot in a group reads from here on (ADR-0015 D6). */
  joinedAt: string | null;
}

interface Room {
  /** The bots this message is owed an answer from, in the order to answer. */
  owed: Seat[];
  /** One person and one bot: every message is answered, and it is private. */
  direct: boolean;
  names: Map<string, string>;
}

/**
 * Who a message is owed an answer from (ADR-0015 D3).
 *
 * One person and one bot: that bot, always. More than two voices: the bots
 * the message names, at most MAX_BOTS_PER_MESSAGE. A bot's own line is never
 * owed an answer, so two bots cannot keep each other talking: that is
 * stricter than D3's bounded round, and it costs nothing to loosen later.
 */
async function roomOf(
  admin: SupabaseClient,
  conversationId: string,
  senderId: string,
  content: string
): Promise<Room | null> {
  const { data } = await fromTable(admin, DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id, joined_at')
    .eq('conversation_id', conversationId)
    .eq('is_active', true);
  const members = (data ?? []) as Array<{ user_id: string; joined_at: string | null }>;
  const ids = members.map(m => m.user_id);
  const seats = await seatsOfAccounts(admin, ids);
  if (seats.size === 0 || seats.has(senderId)) {
    return null;
  }
  const { data: profiles } = await fromTable(admin, DATABASE_TABLES.PROFILES)
    .select('id, name, username')
    .in('id', ids);
  const names = new Map<string, string>();
  for (const p of (profiles ?? []) as Array<{
    id: string;
    name: string | null;
    username: string | null;
  }>) {
    names.set(p.id, p.name?.trim() || p.username || 'Someone');
  }
  const bots: Seat[] = members
    .filter(m => seats.has(m.user_id))
    .map(m => ({
      userId: m.user_id,
      assistantId: seats.get(m.user_id) ?? null,
      name: names.get(m.user_id) ?? 'The bot',
      joinedAt: m.joined_at,
    }));
  const others = ids.filter(id => id !== senderId);
  const direct = others.length === 1;
  return { owed: direct ? bots : namedBots(content, bots), direct, names };
}

/** What a bot says in place of an answer it could not give. */
function refusalWords(error: { code: string; message?: string }, name: string): string {
  if (error.message) {
    return error.message;
  }
  return error.code === 'INSUFFICIENT_CREDITS'
    ? `${name} charges per message and your Cat Credits do not cover this one.`
    : BOT_FALLBACK_REPLY;
}

async function answerOne(
  admin: SupabaseClient,
  params: { conversationId: string; senderId: string; seat: Seat; room: Room }
): Promise<boolean> {
  const { conversationId, senderId, seat, room } = params;
  const { name } = seat;

  let query = fromTable(admin, DATABASE_TABLES.MESSAGES)
    .select('sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false);
  if (!room.direct && seat.joinedAt) {
    // In company a bot reads from the moment it was added, not what was said
    // before it came (ADR-0015 D6).
    query = query.gte('created_at', seat.joinedAt);
  }
  const { data: rows } = await query
    .order('created_at', { ascending: false })
    .limit(CAT_CONTEXT_MESSAGE_WINDOW);
  const transcript = transcriptForSeat(
    ((rows ?? []) as Array<{ sender_id: string; content: string | null }>).slice().reverse(),
    seat.userId,
    room.direct ? undefined : room.names
  );
  const last = transcript[transcript.length - 1];
  if (!last || last.role !== 'user') {
    // Only files, or nothing to answer.
    return false;
  }

  let refusal: { code: string; message?: string } | null = null;
  if (!seat.assistantId) {
    // Its companion was deleted: say so, in its place.
    refusal = { code: 'NOT_FOUND', message: `${name} is not here any more.` };
  } else if (!room.direct) {
    // In a group, somebody other than the bot's owner may name it. A private
    // bot answers its owner only, and says so instead of saying nothing.
    const { data: companion } = await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
      .select('status, is_public, user_id')
      .eq('id', seat.assistantId)
      .maybeSingle();
    const access = companion
      ? decideConversationAccess(
          companion as { status: string | null; is_public: boolean | null; user_id: string },
          senderId
        )
      : null;
    if (!access?.allowed) {
      refusal = {
        code: 'NOT_FOUND',
        message: `${name} answers only the person who brought it into this conversation.`,
      };
    }
  }

  let reply = '';
  let settle: ((messageId: string) => Promise<void>) | null = null;
  if (!refusal && seat.assistantId) {
    const asker = room.names.get(senderId) ?? 'Someone';
    const answer = await companionAnswer({
      supabase: admin,
      userId: senderId,
      assistantId: seat.assistantId,
      name,
      history: transcript.slice(0, -1),
      content: last.content,
      // What the asker told this bot in private stays out of a group.
      recall: room.direct,
      scene: room.direct
        ? messagesScene
        : definition =>
            groupScene(definition, {
              name,
              asker,
              others: [...room.names.entries()]
                .filter(([id]) => id !== seat.userId)
                .map(([, who]) => who),
            }),
    });
    if ('error' in answer) {
      refusal = answer.error;
    } else {
      reply = answer.content.trim() || BOT_FALLBACK_REPLY;
      settle = answer.settle;
    }
  }
  if (refusal) {
    reply = refusalWords(refusal, name);
    logger.warn('A bot could not answer', { conversationId, code: refusal.code }, 'BotSeats');
  }

  const messageId = await writeMessage(admin, {
    conversationId,
    senderId: seat.userId,
    content: reply,
    // In company an agent's words say whom they were for: the thread shows
    // "Bot · for <the person who named it>".
    metadata: room.direct ? { is_bot_reply: true } : { is_bot_reply: true, requested_by: senderId },
  });
  if (settle) {
    await settle(messageId);
  }
  return true;
}

/**
 * Answer a message a person just sent, from every bot it is owed an answer
 * from (see `roomOf`).
 *
 * Runs after the person's message is stored and their request has been
 * answered. On the asker's own key or their free allowance, at each
 * companion's price (ADR-0015 D4). A failure to think is still answered, in
 * words: a limit reached says so with its way out, anything else is the
 * fallback line.
 *
 * @returns how many messages were written.
 */
export async function answerAsBot(
  admin: SupabaseClient,
  params: { conversationId: string; senderId: string; content: string }
): Promise<number> {
  const { conversationId, senderId, content } = params;
  let written = 0;
  try {
    const room = await roomOf(admin, conversationId, senderId, content);
    if (!room) {
      return 0;
    }
    // One after the other, so each bot reads what the one before it said.
    for (const seat of room.owed) {
      try {
        if (await answerOne(admin, { conversationId, senderId, seat, room })) {
          written += 1;
        }
      } catch (error) {
        logger.error(
          'Bot answer failed',
          {
            conversationId,
            bot: seat.userId,
            error: error instanceof Error ? error.message : String(error),
          },
          'BotSeats'
        );
      }
    }
  } catch (error) {
    logger.error(
      'Could not work out which bot to ask',
      { conversationId, error: error instanceof Error ? error.message : String(error) },
      'BotSeats'
    );
  }
  return written;
}

/** `answerAsBot` for the send route: on the service role, never throwing. */
export function answerAfterSend(
  conversationId: string,
  senderId: string,
  content: string
): Promise<number> {
  return answerAsBot(createAdminClient(), { conversationId, senderId, content });
}
