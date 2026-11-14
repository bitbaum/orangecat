/**
 * Which hands one bot has, and how: the owner's switch per bot, per hand.
 *
 * Three settings, in the owner's words:
 *  - off:  the bot is not offered the hand at all.
 *  - ask:  the bot may propose it, and nothing runs until the owner taps.
 *          This is every hand's setting until the owner changes it.
 *  - auto: the bot runs it itself, as its owner, and is handed the result
 *          so it can carry on (services/ai/sendMessage.ts, the work loop).
 *          Only for hands that work in the owner's Loki (canRunOnItsOwn).
 *
 * Only "off" and "auto" are stored; no row means "ask". A hand is still only
 * ever one from COMPANION_HANDS, an "auto" hand is still checked against the
 * owner's permissions on every turn, and Loki answers as the account linked
 * to the owner, so this narrows or pre-approves what a bot may do for its
 * owner and can never reach anyone else's things.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import { isConnectorHand } from '@/services/connectors/hands';
import { isLokiHand } from '@/services/loki/hands';
import { isPlannerHand } from '@/services/planner/hands';
import { COMPANION_HANDS } from './hands';

export const HAND_MODES = ['off', 'ask', 'auto'] as const;
export type HandMode = (typeof HAND_MODES)[number];

export type HandGrants = ReadonlyMap<string, HandMode>;

/** A hand's setting for one bot: what is stored, or "ask". */
export function handMode(grants: HandGrants | null | undefined, actionId: string): HandMode {
  return grants?.get(actionId) ?? 'ask';
}

export function isHand(actionId: string): boolean {
  return COMPANION_HANDS.includes(actionId);
}

/**
 * Whether a hand may be switched to "on its own" at all.
 *
 * Only the hands that work in the owner's own Loki can: reading sessions and
 * runs, asking, sending a task to an agent session. A hand that makes
 * something on OrangeCat (an event, a project, a product) publishes, and
 * what a bot was told in confidence must never become public without its
 * owner seeing it first, so those always wait for a tap.
 *
 * So can the hands that read an account the owner connected (GitHub, mail,
 * calendar): they only read, as the owner, and a morning routine that waits
 * for a tap before it may look at the calendar is no routine.
 *
 * And the owner's own planner (their to-do list and calendar): what a bot
 * writes there is private to the owner and can be taken out again, so the
 * reason the "makes something on OrangeCat" hands wait does not apply.
 */
export function canRunOnItsOwn(actionId: string): boolean {
  return (
    isHand(actionId) &&
    (isLokiHand(actionId) || isConnectorHand(actionId) || isPlannerHand(actionId))
  );
}

/** The owner's settings for one bot. A failed read is "ask" for everything: never more than a tap allows. */
export async function getHandGrants(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId: string
): Promise<HandGrants> {
  const grants = new Map<string, HandMode>();
  try {
    const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_HAND_GRANTS)
      .select('action_id, mode')
      .eq('user_id', userId)
      .eq('assistant_id', assistantId);
    if (error) {
      throw error;
    }
    for (const row of (data ?? []) as Array<{ action_id: string; mode: string }>) {
      if (isHand(row.action_id) && (row.mode === 'off' || row.mode === 'auto')) {
        grants.set(row.action_id, row.mode);
      }
    }
  } catch (error) {
    logger.warn('hand grants could not be read', { error, assistantId }, 'CompanionHands');
  }
  return grants;
}

/** Set one hand for one bot. "ask" removes the row. */
export async function setHandGrant(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId: string,
  actionId: string,
  mode: HandMode
): Promise<void> {
  const table = fromTable(supabase, DATABASE_TABLES.COMPANION_HAND_GRANTS);
  if (mode === 'ask') {
    const { error } = await table
      .delete()
      .eq('user_id', userId)
      .eq('assistant_id', assistantId)
      .eq('action_id', actionId);
    if (error) {
      throw new Error(`Failed to reset hand grant: ${error.message}`);
    }
    return;
  }
  const { error } = await table.upsert(
    {
      user_id: userId,
      assistant_id: assistantId,
      action_id: actionId,
      mode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,assistant_id,action_id' }
  );
  if (error) {
    throw new Error(`Failed to save hand grant: ${error.message}`);
  }
}
