/**
 * Is this a conversation between one person and the Cat?
 *
 * In company the Cat answers when it is tagged: tagging is the consent to be
 * read. Alone with it there is nobody else a message could be for, so every
 * message is for the Cat and asking for a tag is asking a person to say the
 * name of the only one they are talking to. Both the write path (is an answer
 * owed?) and the reply (how is it worded?) ask this one question here.
 */

import { CAT_USERNAME } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { normalizeUsername } from '@/config/usernames';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function isAloneWithCat(
  admin: SupabaseClient,
  conversationId: string,
  personId: string
): Promise<boolean> {
  const { data: members } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('is_active', true);
  const ids = ((members ?? []) as Array<{ user_id: string }>).map(m => m.user_id);
  if (ids.length !== 2 || !ids.includes(personId)) {
    return false;
  }
  const other = ids.find(id => id !== personId);
  if (!other) {
    return false;
  }
  const { data: profile } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('id', other)
    .maybeSingle();
  const username = (profile as { username?: string | null } | null)?.username;
  return username ? normalizeUsername(username) === normalizeUsername(CAT_USERNAME) : false;
}
