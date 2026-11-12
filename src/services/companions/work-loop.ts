/**
 * A bot working on its own: one step of the loop, and when the loop ends.
 *
 * When the owner switches a hand to "on its own" for a bot, a proposal for
 * it runs at once instead of waiting for a tap, and the bot is handed the
 * result so it can take the next step (services/ai/sendMessage.ts drives
 * the loop). That is what lets a bot do a job: start an agent session in
 * Loki, wait for the answer, read it, report it.
 *
 * A step never goes through the Cat's executor or handlers (the seam in
 * __tests__/unit/companions/import-boundary.test.ts): it calls the Loki
 * rail's own function for that hand (services/loki/hands.ts), the same body
 * the Cat's card runs. So only Loki hands can be a step, and each runs as
 * the Loki account linked to the bot's owner.
 *
 * Two limits keep a job from running away: a number of steps, and the
 * turn's own time. Past either, the bot stops where it is. Every step is a
 * line of the thread, marked as the bot's own, which is its record.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { followLokiRun, runToFollow } from '@/services/loki/follow-run';
import { LOKI_HANDS } from '@/services/loki/hands';
import type { LokiTaskProjectResult } from '@/services/loki/task-dispatch';
import { logger } from '@/utils/logger';
import type { Proposal } from './hands';

const LOG = 'CompanionWorkLoop';

/** Hands a bot may run in one turn before it stops and reports. */
export const MAX_AUTO_STEPS = 6;
/** No new step starts after this much of the turn has gone. */
export const AUTO_STEP_BUDGET_MS = 150_000;

export function mayTakeStep(stepsTaken: number, elapsedMs: number): boolean {
  return stepsTaken < MAX_AUTO_STEPS && elapsedMs < AUTO_STEP_BUDGET_MS;
}

/** The one line a step leaves: what Loki said, or why it did not go through. */
export function stepLine(outcome: { success: boolean; data?: unknown; error?: string }): string {
  if (!outcome.success) {
    return outcome.error?.trim() || 'That did not go through.';
  }
  const shown = (outcome.data as { displayMessage?: unknown } | undefined)?.displayMessage;
  return typeof shown === 'string' && shown.trim() ? shown.trim() : 'Done.';
}

/**
 * Run one step and return the text the bot is handed. A task sent to Loki
 * is also followed: the run is waited for and the session's conversation
 * read, so the bot gets the agent's answer, not only "sent".
 */
export async function runAutoStep(
  supabase: AnySupabaseClient,
  actorId: string,
  conversationId: string,
  proposal: Proposal
): Promise<{ ok: boolean; text: string }> {
  const hand = LOKI_HANDS[proposal.action];
  if (!hand) {
    // Offered as "on its own" but not a Loki hand: never run, say so.
    logger.warn('auto step refused: not a Loki hand', { actionId: proposal.action }, LOG);
    return { ok: false, text: 'That one needs your tap; it was not run.' };
  }
  let outcome: Awaited<ReturnType<typeof hand>>;
  try {
    outcome = await hand(actorId, proposal.parameters);
  } catch (error) {
    logger.error('auto step threw', error, LOG);
    outcome = { success: false, error: 'That could not be run just now.' };
  }
  const line = stepLine(outcome);
  logger.info('bot ran a hand on its own', { actionId: proposal.action, ok: outcome.success }, LOG);
  await noteInThread(supabase, conversationId, line, proposal.action, outcome.success);
  if (!outcome.success || proposal.action !== 'send_task_to_loki') {
    return { ok: outcome.success, text: line };
  }
  const target = runToFollow((outcome.data as { results?: LokiTaskProjectResult[] })?.results);
  if (!target) {
    return { ok: true, text: line };
  }
  const followed = await followLokiRun(actorId, target);
  await noteInThread(supabase, conversationId, followed.text, 'loki_run_follow', true);
  return { ok: true, text: `${line}\n\n${followed.text}` };
}

/** What a step did is a line of the thread, so the person reads it where they asked. */
async function noteInThread(
  supabase: AnySupabaseClient,
  conversationId: string,
  content: string,
  actionId: string,
  ok: boolean
): Promise<void> {
  const { error } = await fromTable(supabase, DATABASE_TABLES.AI_MESSAGES).insert({
    conversation_id: conversationId,
    role: 'assistant',
    content,
    tokens_used: 0,
    cost_btc: 0,
    api_cost_btc: 0,
    creator_markup_btc: 0,
    metadata: { outcome: { action_id: actionId, ok, own: true } },
  });
  if (error) {
    logger.warn('step not noted in thread', { error, actionId }, LOG);
  }
}
