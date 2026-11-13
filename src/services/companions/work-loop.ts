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
 * rail's own function for that hand (services/loki/hands.ts), or the read
 * of an account the owner connected (services/connectors/hands.ts): the same
 * bodies the Cat's cards run. So only those hands can be a step; a Loki one
 * runs as the Loki account linked to the bot's owner, a read with the
 * owner's own token.
 *
 * Two limits keep a job from running away: a number of steps, and the
 * turn's own time. Past either, the bot stops where it is. Every step is a
 * line of the thread, marked as the bot's own, which is its record.
 */
import { CAT_ACTIONS, type CatAction } from '@/config/cat-actions';
import { DATABASE_TABLES } from '@/config/database-tables';
import { canGrantOnConfirm } from '@/services/cat/action-types';
import { CatPermissionService } from '@/services/cat/permission-service';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import {
  CONNECTOR_HANDS,
  OUTSIDE_CONTENT_NOTE,
  isConnectorHand,
} from '@/services/connectors/hands';
import { followLokiRun, runToFollow } from '@/services/loki/follow-run';
import { LOKI_HANDS, isLokiHand } from '@/services/loki/hands';
import type { LokiSession } from '@/services/loki/sessions';
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
  userId: string,
  actorId: string,
  conversationId: string,
  proposal: Proposal
): Promise<{ ok: boolean; text: string }> {
  // A read of a connected account, or a hand in the owner's Loki.
  const reads = isConnectorHand(proposal.action);
  const action = CAT_ACTIONS[proposal.action];
  if ((!reads && !isLokiHand(proposal.action)) || !action) {
    // Offered as "on its own" but not a hand that can be: never run, say so.
    logger.warn('auto step refused: not an own-run hand', { actionId: proposal.action }, LOG);
    return { ok: false, text: 'That one needs your tap; it was not run.' };
  }
  // Checked again for every step, not once a turn: a daily limit the owner
  // set holds across a job's steps too.
  const refusal = await stepRefusal(supabase, userId, action);
  if (refusal) {
    await logStep(supabase, userId, action, proposal.parameters, conversationId, {
      success: false,
      error: refusal,
    });
    return { ok: false, text: refusal };
  }
  let outcome: { success: boolean; data?: unknown; error?: string };
  try {
    outcome = reads
      ? await CONNECTOR_HANDS[proposal.action](userId, proposal.parameters)
      : await LOKI_HANDS[proposal.action](actorId, proposal.parameters);
  } catch (error) {
    logger.error('auto step threw', error, LOG);
    outcome = { success: false, error: 'That could not be run just now.' };
  }
  await logStep(supabase, userId, action, proposal.parameters, conversationId, outcome);
  const line = stepLine(outcome);
  logger.info('bot ran a hand on its own', { actionId: proposal.action, ok: outcome.success }, LOG);
  await noteInThread(supabase, conversationId, line, proposal.action, outcome.success);
  if (!outcome.success) {
    return { ok: false, text: line };
  }
  if (reads) {
    // The thread shows what was read; the bot is also told whose words they are.
    return { ok: true, text: `${line}\n\n${OUTSIDE_CONTENT_NOTE}` };
  }
  const target =
    proposal.action === 'send_task_to_loki'
      ? runToFollow((outcome.data as { results?: LokiTaskProjectResult[] })?.results)
      : proposal.action === 'loki_run_status'
        ? runStillGoing((outcome.data as { sessions?: LokiSession[] })?.sessions)
        : null;
  if (!target) {
    return { ok: true, text: line };
  }
  const followed = await followLokiRun(actorId, target);
  await noteInThread(supabase, conversationId, followed.text, 'loki_run_follow', true);
  return { ok: true, text: `${line}\n\n${followed.text}` };
}

/**
 * Why a step may not run now, or null when it may: the owner's own Cat
 * permission, read at the moment of the step. A hand never granted but
 * grantable by a tap runs, because switching it on for this bot was the
 * owner's consent (hand-grants.ts); a limit reached or a hand withdrawn does not.
 */
async function stepRefusal(
  supabase: AnySupabaseClient,
  userId: string,
  action: CatAction
): Promise<string | null> {
  try {
    const check = await new CatPermissionService(supabase).checkPermission(userId, action.id);
    if (check.allowed || canGrantOnConfirm(action, check.code)) {
      return null;
    }
    return check.code === 'daily_limit_reached'
      ? `Not run: ${check.reason}. It runs again tomorrow, or with your tap.`
      : 'Not run: that is no longer allowed for your Cat. It needs your tap.';
  } catch (error) {
    logger.warn('auto step permission check failed', { error, actionId: action.id }, LOG);
    return 'Not run: its permission could not be checked just now.';
  }
}

/**
 * The step in the owner's action log, like every action the Cat runs: it is
 * what the daily limit counts and what the owner reads back later.
 */
async function logStep(
  supabase: AnySupabaseClient,
  userId: string,
  action: CatAction,
  parameters: Record<string, unknown>,
  conversationId: string,
  outcome: { success: boolean; data?: unknown; error?: string }
): Promise<void> {
  const at = new Date().toISOString();
  const { error } = await fromTable(supabase, DATABASE_TABLES.CAT_ACTION_LOG).insert({
    user_id: userId,
    action_id: action.id,
    category: action.category,
    parameters,
    status: outcome.success ? 'completed' : 'failed',
    conversation_id: conversationId,
    started_at: at,
    completed_at: at,
    result: outcome.success ? { ranOnItsOwn: true } : null,
    error_message: outcome.success ? null : (outcome.error ?? 'failed'),
  });
  if (error) {
    logger.warn('auto step not logged', { error, actionId: action.id }, LOG);
  }
}

/**
 * A run read back while it is still going is followed too, so "check again"
 * waits for the answer instead of spending a step on "still working".
 */
export function runStillGoing(
  sessions: readonly LokiSession[] | undefined
): { project: string; runId: string } | null {
  const s = sessions?.[0];
  return s?.runId && ['queued', 'starting', 'working'].includes(s.state)
    ? { project: s.project, runId: s.runId }
    : null;
}

/** A step the owner's rules turned into a tap: said in the thread, as the bot's own line. */
export async function noteHeldStep(
  supabase: AnySupabaseClient,
  conversationId: string,
  line: string,
  actionId: string
): Promise<void> {
  await noteInThread(supabase, conversationId, line, actionId, false);
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
