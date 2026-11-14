/**
 * Search inside one conversation.
 *
 * The fleet's rule is that a search box is `@bitbaum/searchkit`, never a
 * ranker written here: so the words are forgiven a typing slip ("pengiun"
 * finds "penguin") and a match is ranked the way every other search on the
 * site ranks. The conversation's newest messages are read once and searched
 * in memory; a conversation is small next to what Postgres holds, and this
 * keeps the typo rules in one place instead of a second copy in SQL.
 */

import { search } from '@bitbaum/searchkit';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createAdminClient } from '@/lib/supabase/admin';
import { fromTable } from '@/lib/supabase/untyped';
import type { Message } from '../types';
import { assertMember } from './shared';

/** How far back a search reads. Older messages are not found, and the route
 *  says how many were searched so nobody takes "nothing" for "never said". */
export const SEARCH_SCAN_LIMIT = 2000;
/** How many matches come back. */
export const SEARCH_RESULT_LIMIT = 30;

type Row = Pick<
  Message,
  | 'id'
  | 'conversation_id'
  | 'sender_id'
  | 'content'
  | 'message_type'
  | 'metadata'
  | 'created_at'
  | 'updated_at'
  | 'is_deleted'
  | 'edited_at'
>;

/** The matches among these messages, best first, newest first among equals. */
export function matchingMessages(rows: readonly Row[], query: string): Row[] {
  const asked = query.trim();
  if (!asked) {
    return [];
  }
  return search(
    rows,
    {
      fields: [{ name: 'content', get: row => row.content }],
      // Among equally good matches, the newer message is the likelier one.
      rank: row => Date.parse(row.created_at) || 0,
    },
    asked,
    { limit: SEARCH_RESULT_LIMIT }
  ).map(hit => hit.item);
}

/**
 * The messages of a conversation that hold these words. Only somebody in the
 * conversation may search it (`assertMember` throws 403 otherwise).
 */
export async function searchConversationMessages(
  conversationId: string,
  userId: string,
  query: string
): Promise<{ messages: Message[]; searched: number }> {
  const admin = createAdminClient();
  await assertMember(admin, conversationId, userId);
  const { data, error } = await fromTable(admin, DATABASE_TABLES.MESSAGES)
    .select(
      'id, conversation_id, sender_id, content, message_type, metadata, created_at, updated_at, is_deleted, edited_at'
    )
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(SEARCH_SCAN_LIMIT);
  if (error) {
    throw Object.assign(new Error('Could not search the conversation'), { status: 500 });
  }
  const rows = ((data ?? []) as Row[]).filter(row => (row.content ?? '').trim().length > 0);
  return { messages: matchingMessages(rows, query) as Message[], searched: rows.length };
}
