/**
 * The Cat action audit trail.
 *
 * Every action Cat attempts leaves a row in cat_action_log — including the ones
 * it was refused. That matters beyond bookkeeping: the track record and the
 * spend-cap accounting both read this table, and a denial that is never written
 * makes the record show only wins while today's BTC budget silently under-counts.
 *
 * Split out of action-executor.ts because writing the trail is a different job
 * from deciding what to run: the executor's concern is permission and dispatch,
 * this file's concern is that the record is honest.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { CatAction } from '@/config/cat-actions';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

/**
 * BTC an action would move, for the log's amount_btc column and the daily
 * spend accounting derived from it. Non-payment actions move nothing.
 */
export function extractBtcAmount(
  action: CatAction,
  parameters: Record<string, unknown>
): number | null {
  if (action.category === 'payments') {
    return (
      (parameters.amount_btc as number) ||
      (parameters.price_btc as number) ||
      (parameters.price as number) ||
      null
    );
  }
  return null;
}

/**
 * Audit a denial that happens BEFORE performAction opens a log row (early
 * permission / spend-cap checks). One terminal insert, fire-and-safe: a failed
 * write only warns — denying the action never depends on logging it.
 */
export async function logDeniedAction(
  supabase: AnySupabaseClient,
  input: {
    userId: string;
    action: CatAction;
    parameters: Record<string, unknown>;
    reason: string;
    conversationId?: string;
    messageId?: string;
  }
): Promise<void> {
  const { userId, action, parameters, reason, conversationId, messageId } = input;
  const { error } = await supabase.from(DATABASE_TABLES.CAT_ACTION_LOG).insert({
    user_id: userId,
    action_id: action.id,
    category: action.category,
    parameters,
    status: 'denied',
    error_message: reason,
    conversation_id: conversationId || null,
    message_id: messageId || null,
    completed_at: new Date().toISOString(),
    amount_btc: extractBtcAmount(action, parameters),
  });
  if (error) {
    logger.warn('Failed to log denied action', { error: error.message }, 'CatActionLog');
  }
}

/** Close an open log row with its terminal status. */
export async function updateActionLog(
  supabase: AnySupabaseClient,
  logId: string,
  status: 'completed' | 'failed' | 'denied',
  result: unknown,
  errorMessage?: string
): Promise<void> {
  await supabase
    .from(DATABASE_TABLES.CAT_ACTION_LOG)
    .update({
      status,
      result: result || null,
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

/** Recent action-log rows for a user, newest first. */
export async function getActionHistory(
  supabase: AnySupabaseClient,
  userId: string,
  options: { limit?: number; actionId?: string; status?: string } = {}
) {
  let query = supabase
    .from(DATABASE_TABLES.CAT_ACTION_LOG)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options.limit || 50);

  if (options.actionId) {
    query = query.eq('action_id', options.actionId);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data } = await query;
  return data || [];
}
