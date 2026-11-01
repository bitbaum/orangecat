/**
 * What a bot did stays in the thread.
 *
 * A "Do it?" card's outcome used to live only in the slot above the composer:
 * it left the screen when a second card arrived, and was gone on reload
 * (seen live 2026-11-01). The outcome is now a line of the conversation the
 * card came from, stored like any other turn, so the person reads what
 * happened where they asked for it, and the bot's next turn knows it too.
 *
 * Only a card that was proposed in a bot's own thread has a conversation to
 * write to; the Cat's chat keeps its own record. A failure to record never
 * fails the confirm: the action already ran.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ActionResult } from '@/services/cat/action-types';
import { logger } from '@/utils/logger';

/** The one line the thread keeps: what happened, and the page if there is one. */
export function outcomeLine(result: ActionResult, description: string): string {
  const data = (result.data ?? {}) as { displayMessage?: unknown; url?: unknown };
  if (!result.success) {
    return (result.error && result.error.trim()) || `${description}: that did not go through.`;
  }
  const text =
    typeof data.displayMessage === 'string' && data.displayMessage.trim()
      ? data.displayMessage.trim()
      : description;
  return typeof data.url === 'string' && data.url ? `${text} [Open](${data.url})` : text;
}

/** Record a confirmed card's outcome in the bot thread it was proposed in, if any. */
export async function recordCardOutcome(
  supabase: AnySupabaseClient,
  userId: string,
  pendingActionId: string,
  result: ActionResult
): Promise<void> {
  try {
    const { data: pending } = await supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .select('conversation_id, description, action_id')
      .eq('id', pendingActionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!pending?.conversation_id) {
      return;
    }
    const { data: thread } = await supabase
      .from(DATABASE_TABLES.AI_CONVERSATIONS)
      .select('id')
      .eq('id', pending.conversation_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!thread) {
      return;
    }
    const { error } = await supabase.from(DATABASE_TABLES.AI_MESSAGES).insert({
      conversation_id: thread.id,
      role: 'assistant',
      content: outcomeLine(result, pending.description ?? ''),
      tokens_used: 0,
      cost_btc: 0,
      api_cost_btc: 0,
      creator_markup_btc: 0,
      metadata: {
        outcome: { action_id: pending.action_id, ok: result.success, status: result.status },
      },
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('card outcome not recorded', { error, pendingActionId }, 'CompanionOutcomes');
  }
}
