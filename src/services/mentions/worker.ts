/**
 * Paying the debts in the queue.
 *
 * Deliberately small and dumb: claim, dispatch, mark. Everything that decides
 * WHAT the Cat says lives in cat-reply.ts, and everything that decides whether
 * a mention exists lives in the resolver — so this file can be read in one sitting
 * and changed without touching either.
 */

import { ensureCatAccount } from '@/services/mentions/cat-account';
import { replyToConversationMention } from '@/services/mentions/cat-reply';
import { replyToPostMention } from '@/services/mentions/cat-post-reply';
import { actOnPostInstruction } from '@/services/mentions/cat-post-instruction';
import { resolveMentions } from '@/services/mentions/resolve';
import { notifyMentionedPeople } from '@/services/mentions/notify-mentions';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  claimMentions,
  completeMention,
  failMention,
  type ClaimedMention,
} from '@/services/mentions/queue';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MentionRunResult {
  claimed: number;
  answered: number;
  failed: number;
}

/** How many mentions one tick will answer. Keeps a burst from monopolising the LLM budget. */
export const DEFAULT_BATCH = 5;

export async function runCatMentions(
  admin: SupabaseClient,
  limit: number = DEFAULT_BATCH
): Promise<MentionRunResult> {
  const result: MentionRunResult = { claimed: 0, answered: 0, failed: 0 };

  // BEFORE claiming, and before the empty-queue exit, because otherwise the
  // system deadlocks on itself: resolveMentions can only flag @cat when a Cat
  // profile exists, so with no account nothing ever queues — and if the account
  // were only created when something was queued, nothing ever would be. The
  // every-minute tick is therefore also what brings the Cat into existence.
  // Cheap enough to do unconditionally: one primary-key lookup when it is a
  // no-op, which is always after the first run.
  const cat = await ensureCatAccount(admin);

  const claimed = await claimMentions(admin, limit);
  result.claimed = claimed.length;
  if (claimed.length === 0) {
    return result;
  }

  if (!cat) {
    for (const mention of claimed) {
      await failMention(admin, mention, 'no Cat account');
    }
    result.failed = claimed.length;
    return result;
  }

  for (const mention of claimed) {
    try {
      const answered = await answer(admin, mention, cat.id);
      if (answered) {
        await completeMention(admin, mention.id);
        result.answered += 1;
      } else {
        await failMention(admin, mention, 'nothing to answer');
        result.failed += 1;
      }
    } catch (error) {
      await failMention(admin, mention, error instanceof Error ? error.message : String(error));
      result.failed += 1;
    }
  }

  if (result.answered > 0 || result.failed > 0) {
    logger.info('Cat mention run', { ...result }, 'CatMentions');
  }
  return result;
}

async function answer(
  admin: SupabaseClient,
  mention: ClaimedMention,
  catId: string
): Promise<boolean> {
  if (mention.conversation_id) {
    return replyToConversationMention(admin, {
      conversationId: mention.conversation_id,
      requesterId: mention.requester_id,
      catId,
    });
  }

  if (mention.parent_event_id) {
    return processPostMentions(admin, mention, catId);
  }

  return false;
}

/**
 * One resolve, two outcomes.
 *
 * The trigger is a PREFILTER — it queues any post containing '@', so
 * `bob@example.com` and `@catalogue` arrive here too. The resolver is the
 * authority and this is the only place its verdict is applied, which is what
 * keeps detection from being written once per surface.
 *
 * Both jobs come from that single answer: reply if the Cat was named, and tell
 * the people who were. Nothing named at all is a resolved row, not a failure —
 * marking it failed would retry a post that asked for nothing three times and
 * then log an error about it.
 */
async function processPostMentions(
  admin: SupabaseClient,
  mention: ClaimedMention,
  catId: string
): Promise<boolean> {
  const eventId = mention.parent_event_id as string;

  const { data } = await admin
    .from(DATABASE_TABLES.TIMELINE_EVENTS)
    .select('title, description, actor_id')
    .eq('id', eventId)
    .maybeSingle();

  if (!data) {
    return false;
  }
  const row = data as { title: string | null; description: string | null; actor_id: string };
  const text = `${row.description ?? ''}\n${row.title ?? ''}`;

  const { mentions, mentionsCat } = await resolveMentions(admin, text);
  if (mentions.length === 0) {
    return true;
  }

  await notifyMentionedPeople(admin, {
    mentions,
    authorId: row.actor_id,
    eventId,
    excerpt: row.description ?? row.title ?? '',
  });

  if (!mentionsCat) {
    return true;
  }
  // "@cat watch this for me" is done by the tagger's own Cat, then answered;
  // anything that is not an instruction is answered as before.
  const acted = await actOnPostInstruction(admin, {
    eventId,
    catId,
    requesterId: mention.requester_id,
  });
  return acted || replyToPostMention(admin, { eventId, catId });
}
