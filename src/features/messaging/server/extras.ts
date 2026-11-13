/**
 * What a message carries besides words and files: the message it answers,
 * the reactions on it, and a payment request.
 *
 * All three are decided by PARTICIPATION and read with the service role, like
 * the files (./attachments.ts). Nothing here trusts what a browser says a
 * message is: a reply is re-read from the message it names, a payment request
 * from its own row.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import type { MessagePaymentRequestDto, MessageReactionDto, MessageReplyDto } from '../types';

/** How much of a message its quote keeps (the Messenger cuts at the same length). */
export const REPLY_EXCERPT_MAX = 140;

/** Where each of these rides in messages.metadata. Server-owned: a client's
 *  own values under these keys are dropped before the row is written. */
export const REPLY_KEY = 'reply_to';
export const PAYMENT_REQUEST_KEY = 'payment_request_id';
export const SERVER_METADATA_KEYS = [REPLY_KEY, PAYMENT_REQUEST_KEY, 'client_id'] as const;

/** A client's metadata without the keys only the server may write. */
export function withoutServerKeys(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const kept = { ...(metadata ?? {}) };
  for (const key of SERVER_METADATA_KEYS) {
    delete kept[key];
  }
  return kept;
}

export function excerpt(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim();
  return words.length > REPLY_EXCERPT_MAX
    ? `${words.slice(0, REPLY_EXCERPT_MAX - 1).trimEnd()}…`
    : words;
}

/**
 * The message being answered, as the answer will quote it. Null when it is
 * not a message of this conversation (or is gone): the answer is then sent
 * as an ordinary message, never refused.
 */
export async function replySnapshot(
  admin: SupabaseClient,
  conversationId: string,
  messageId: string
): Promise<MessageReplyDto | null> {
  const { data } = await fromTable(admin, DATABASE_TABLES.MESSAGES)
    .select('id, sender_id, content')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .maybeSingle();
  const row = data as { id: string; sender_id: string; content: string | null } | null;
  if (!row) {
    return null;
  }
  const { data: files } = await fromTable(admin, DATABASE_TABLES.MESSAGE_ATTACHMENTS)
    .select('kind')
    .eq('message_id', messageId)
    .is('removed_at', null);
  const kinds = (
    (files ?? []) as Array<{ kind: NonNullable<MessageReplyDto['kinds']>[number] }>
  ).map(f => f.kind);
  return {
    id: row.id,
    sender_id: row.sender_id,
    body: excerpt(row.content ?? ''),
    ...(kinds.length > 0 ? { kinds } : {}),
  };
}

/** The quote stored on a message, if its metadata holds a well-formed one. */
export function replyOf(metadata: Record<string, unknown> | null): MessageReplyDto | null {
  const raw = metadata?.[REPLY_KEY] as Partial<MessageReplyDto> | undefined;
  if (!raw || typeof raw.id !== 'string' || typeof raw.sender_id !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    sender_id: raw.sender_id,
    body: typeof raw.body === 'string' ? raw.body : '',
    ...(Array.isArray(raw.kinds) && raw.kinds.length > 0 ? { kinds: raw.kinds } : {}),
  };
}

/** Reactions per message, in the order each emoji was first used. */
export async function reactionsOfMessages(
  admin: SupabaseClient,
  messageIds: readonly string[]
): Promise<Map<string, MessageReactionDto[]>> {
  const grouped = new Map<string, MessageReactionDto[]>();
  if (messageIds.length === 0) {
    return grouped;
  }
  const { data, error } = await fromTable(admin, DATABASE_TABLES.MESSAGE_REACTIONS)
    .select('message_id, user_id, emoji, created_at')
    .in('message_id', [...messageIds])
    .order('created_at', { ascending: true });
  if (error) {
    // A thread without its reactions is still a thread.
    logger.error('Could not load message reactions', { error }, 'Messaging');
    return grouped;
  }
  for (const row of (data ?? []) as Array<{ message_id: string; user_id: string; emoji: string }>) {
    const list = grouped.get(row.message_id) ?? [];
    const same = list.find(r => r.emoji === row.emoji);
    if (same) {
      same.user_ids.push(row.user_id);
    } else {
      list.push({ emoji: row.emoji, user_ids: [row.user_id] });
    }
    grouped.set(row.message_id, list);
  }
  return grouped;
}

/**
 * Put `userId`'s emoji on a message (replacing the one they had), or take it
 * off (`null`). Only somebody in the message's conversation may.
 *
 * The message row is touched afterwards: its UPDATE is what realtime carries
 * to everyone who has the conversation open, so they reload its page and see
 * the reaction. `message_reactions` itself is not published to anybody.
 */
export async function setReaction(
  admin: SupabaseClient,
  userId: string,
  messageId: string,
  emoji: string | null
): Promise<{ ok: true } | { ok: false; code: 'not_found' | 'forbidden' | 'failed' }> {
  const { data: message } = await fromTable(admin, DATABASE_TABLES.MESSAGES)
    .select('id, conversation_id')
    .eq('id', messageId)
    .eq('is_deleted', false)
    .maybeSingle();
  const row = message as { id: string; conversation_id: string } | null;
  if (!row) {
    return { ok: false, code: 'not_found' };
  }
  const { data: seat } = await fromTable(admin, DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id')
    .eq('conversation_id', row.conversation_id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!seat) {
    return { ok: false, code: 'forbidden' };
  }

  const table = fromTable(admin, DATABASE_TABLES.MESSAGE_REACTIONS);
  const { error } =
    emoji === null
      ? await table.delete().eq('message_id', messageId).eq('user_id', userId)
      : await table.upsert(
          { message_id: messageId, user_id: userId, emoji, created_at: new Date().toISOString() },
          { onConflict: 'message_id,user_id' }
        );
  if (error) {
    logger.error('Could not save a reaction', { error, messageId }, 'Messaging');
    return { ok: false, code: 'failed' };
  }
  await fromTable(admin, DATABASE_TABLES.MESSAGES)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', messageId);
  return { ok: true };
}

type RequestRow = Omit<MessagePaymentRequestDto, 'amount_btc' | 'ask_amount'> & {
  amount_btc: number | string;
  ask_amount: number | string | null;
};

/** The payment request a message's metadata names, if it names one. */
export function paymentRequestIdOf(metadata: Record<string, unknown> | null): string | null {
  const id = metadata?.[PAYMENT_REQUEST_KEY];
  return typeof id === 'string' && id ? id : null;
}

/** Payment requests by id, as they stand NOW: a card says "Paid" once it is. */
export async function paymentRequestsById(
  admin: SupabaseClient,
  ids: readonly string[]
): Promise<Map<string, MessagePaymentRequestDto>> {
  const found = new Map<string, MessagePaymentRequestDto>();
  if (ids.length === 0) {
    return found;
  }
  const { data, error } = await fromTable(admin, DATABASE_TABLES.PAYMENT_REQUESTS)
    .select('id, requester_id, payer_id, amount_btc, ask_amount, ask_currency, note, status')
    .in('id', [...new Set(ids)]);
  if (error) {
    logger.error('Could not load payment requests of messages', { error }, 'Messaging');
    return found;
  }
  for (const row of (data ?? []) as RequestRow[]) {
    found.set(row.id, {
      ...row,
      amount_btc: Number(row.amount_btc),
      ask_amount: row.ask_amount === null ? null : Number(row.ask_amount),
    });
  }
  return found;
}

/**
 * May `userId` put this payment request in this conversation? Only their own
 * request, and only where the person asked is in the conversation: a request
 * card is an ask of somebody present, not an advertisement.
 */
export async function claimablePaymentRequest(
  admin: SupabaseClient,
  userId: string,
  conversationId: string,
  requestId: string
): Promise<boolean> {
  const request = (await paymentRequestsById(admin, [requestId])).get(requestId);
  if (!request || request.requester_id !== userId) {
    return false;
  }
  const { data: seat } = await fromTable(admin, DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', request.payer_id)
    .maybeSingle();
  return Boolean(seat);
}
