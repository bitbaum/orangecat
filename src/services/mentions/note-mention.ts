/**
 * The one function a write path calls after storing something a person wrote.
 *
 * Kept separate from both the queue and the messaging helpers on purpose. The
 * messaging layer should not know how the Cat is resolved or queued, and the
 * queue should not know what a conversation is; this is the thin seam between
 * them, and it is the only thing a new surface (wall posts, group chat) has to
 * call to gain the same behaviour.
 */

import { CAT_USERNAME } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { normalizeUsername } from '@/config/usernames';
import { isAloneWithCat } from '@/services/mentions/cat-direct';
import { resolveMentions } from '@/services/mentions/resolve';
import { enqueueMention } from '@/services/mentions/queue';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface NoteMentionInput {
  conversationId: string;
  /**
   * The message row id. Required, and the reason is the unique key: it is what
   * makes one mention owe one reply. Keying on the conversation instead would
   * mean the FIRST question ever asked there is the only one answered, because
   * every later insert would collide and be treated as already queued.
   */
  messageId: string;
  senderId: string;
  content: string;
}

/**
 * Notice that a message is for the Cat, and record that a reply is owed: it
 * tagged the Cat, or it was written in a conversation with only the Cat,
 * where every message is for it.
 *
 * Never throws: a message is a person's words and must be stored whatever the
 * Cat is doing. Everything here is best-effort around a write that has already
 * succeeded.
 */
export async function noteCatMention(
  admin: SupabaseClient,
  input: NoteMentionInput
): Promise<boolean> {
  try {
    // A message of only files has no question in it.
    if (!input.content.trim()) {
      return false;
    }

    // No '@', no resolver: most messages name nobody.
    const tagged =
      input.content.includes('@') && (await resolveMentions(admin, input.content)).mentionsCat;
    if (tagged) {
      // The Cat does not answer itself — otherwise a reply containing the
      // handle would queue another reply, forever.
      if (await senderIsCat(admin, input.senderId)) {
        return false;
      }
    } else if (!(await isAloneWithCat(admin, input.conversationId, input.senderId))) {
      // The Cat's own line is never "alone with the Cat": the other member
      // of its conversation is the person, so it cannot answer itself here.
      return false;
    }

    return await enqueueMention(admin, {
      sourceType: 'message',
      sourceId: input.messageId,
      requesterId: input.senderId,
      conversationId: input.conversationId,
    });
  } catch (error) {
    logger.error(
      'Failed while noting a Cat mention',
      { error: error instanceof Error ? error.message : String(error) },
      'CatMentions'
    );
    return false;
  }
}

async function senderIsCat(admin: SupabaseClient, senderId: string): Promise<boolean> {
  const { data } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('id', senderId)
    .maybeSingle();
  const username = data?.username as string | undefined;
  return username ? normalizeUsername(username) === normalizeUsername(CAT_USERNAME) : false;
}
