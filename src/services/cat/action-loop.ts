/**
 * Cat acts inside the turn.
 *
 * ADR-0006 D2 — the change this whole ADR exists for.
 *
 * BEFORE: the model wrote its entire reply, and only then were ```exec_action```
 * blocks scraped out of the finished text and fired. The system prompt had to
 * carry a rule about it — "its result does NOT exist yet while you write —
 * announce it as in progress… NEVER as already done" — because the model
 * genuinely could not know. It could not say whether something worked, could
 * not retry a failure, and could not use one result to choose the next step.
 *
 * AFTER: the model calls an action as a TOOL, the action executes with every
 * existing gate intact (permissions, spend caps, confirmation, audit log), and
 * the RESULT goes back to the model as a tool message. The model writes its
 * reply last, knowing what actually happened.
 *
 * What this deliberately does NOT change: the executor. Every call still goes
 * through `CatActionExecutor.executeAction`, so permission checks, spend caps,
 * the `cat_action_log` row and the confirmation flow behave exactly as they did
 * when actions were scraped from text. The loop changes WHEN the model learns
 * the outcome, not WHO is allowed to cause it.
 */

import { CAT_ACTIONS, ACTION_CATEGORIES } from '@/config/cat-actions';
import { logger } from '@/utils/logger';
import { actionToolDefinitions, type ActionToolDefinition } from './action-schemas';

/** One model⇄action round trip's worth of state. */
export interface LoopToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LoopStepResult {
  toolCallId: string;
  actionId: string;
  status: 'completed' | 'failed' | 'pending_confirmation' | 'denied';
  /** What the MODEL is told. Short, factual, and safe to read aloud. */
  summary: string;
  data?: unknown;
  pendingActionId?: string;
}

/**
 * Bounded, and bounded lower than it could be.
 *
 * Every step is a full model round trip plus a real write, so this is a spend
 * and latency ceiling as much as a loop guard. Six covers the chains worth
 * having — find → check → create → verify, with room for one correction —
 * while keeping a runaway to something a user notices as slow rather than as
 * a bill.
 */
export const MAX_ACTION_STEPS = 6;

/**
 * Wall clock for the entire loop. The turn is streaming by this point, so an
 * unbounded await is a chat that hangs on typing dots.
 */
export const ACTION_LOOP_TIMEOUT_MS = 45_000;

/** Anything the loop needs from the executor, so this file can be tested alone. */
export interface ActionRunner {
  (call: { actionId: string; parameters: Record<string, unknown> }): Promise<{
    status: 'completed' | 'failed' | 'pending_confirmation' | 'denied';
    data?: unknown;
    error?: string;
    pendingActionId?: string;
  }>;
}

/**
 * Turn one executed action into the sentence the model reads next.
 *
 * This is the highest-leverage prose in the loop: it is what the model bases
 * its reply on, so it must be true, specific, and never optimistic. A failure
 * that reads like a success produces a Cat that tells the user their project
 * is live when it is not.
 */
export function summariseForModel(
  actionId: string,
  result: { status: string; data?: unknown; error?: string }
): string {
  const action = CAT_ACTIONS[actionId];
  const label = action?.name ?? actionId;
  const data = result.data as Record<string, unknown> | undefined;

  switch (result.status) {
    case 'completed': {
      const display = typeof data?.displayMessage === 'string' ? data.displayMessage : null;
      const id = typeof data?.id === 'string' ? data.id : null;
      return [
        `${label}: DONE.`,
        display,
        id ? `id=${id}` : null,
        'You may now state this as completed.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'pending_confirmation': {
      // The user has not agreed yet. If the model reads this as success it
      // will tell them something happened that is still waiting on a tap.
      const pending = data?.pendingAction as { grantOnConfirm?: boolean } | undefined;
      if (pending?.grantOnConfirm) {
        // ADR-0006 D5: the first time Cat wants a capability it does not
        // have, it asks in the conversation, with the action named. The card
        // already carries "Allow and confirm"; this is what lets the reply
        // match the card instead of announcing a done deal.
        const categoryName = action ? ACTION_CATEGORIES[action.category].name : 'this kind of';
        return `${label}: NOT YET ALLOWED — you do not have permission for ${categoryName} actions, so a card is asking the user to allow them and confirm this one. Nothing has been created or changed. Tell them plainly what you want to do and that one tap allows it; they will still confirm each action. Do not say it is done, and do not retry.`;
      }
      return `${label}: WAITING FOR THE USER TO CONFIRM. Nothing has been created or changed yet. Tell them it is ready and needs their confirmation — do not say it is done.`;
    }
    case 'denied': {
      const categoryName = action ? ACTION_CATEGORIES[action.category].name : null;
      const grant = categoryName
        ? `tell the user to allow ${categoryName} actions in their Cat settings if they want this`
        : 'tell the user what to grant';
      return `${label}: NOT PERMITTED — ${result.error ?? 'permission denied'}. Do not retry it; ${grant}.`;
    }
    case 'failed':
    default:
      return `${label}: FAILED — ${result.error ?? 'unknown error'}. If this was a bad parameter you may correct it and try once more; otherwise tell the user plainly.`;
  }
}

/**
 * Execute the actions a model asked for in one step, and produce the messages
 * that go back to it.
 *
 * Runs sequentially on purpose. Two writes in one turn are usually related —
 * create then publish — and running them in parallel means the second cannot
 * see the first, which is the exact defect this loop exists to remove.
 */
export async function runActionStep(
  calls: LoopToolCall[],
  run: ActionRunner
): Promise<LoopStepResult[]> {
  const results: LoopStepResult[] = [];

  for (const call of calls) {
    const actionId = call.name;
    if (!CAT_ACTIONS[actionId]) {
      results.push({
        toolCallId: call.id,
        actionId,
        status: 'failed',
        summary: `Unknown action "${actionId}". Use one of the tools you were given.`,
      });
      continue;
    }

    try {
      const result = await run({ actionId, parameters: call.arguments ?? {} });
      results.push({
        toolCallId: call.id,
        actionId,
        status: result.status,
        summary: summariseForModel(actionId, result),
        data: result.data,
        pendingActionId: result.pendingActionId,
      });
    } catch (error) {
      // A thrown handler is a failed step, not a failed turn: the model gets
      // to tell the user, which is strictly better than a dead stream.
      logger.error('Action step threw', { error, actionId }, 'CatActionLoop');
      results.push({
        toolCallId: call.id,
        actionId,
        status: 'failed',
        summary: summariseForModel(actionId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown error',
        }),
      });
    }
  }

  return results;
}

/**
 * Should the loop keep going after this step?
 *
 * It stops on a step that needs confirmation. The user now owns the next move,
 * and continuing would queue writes behind a decision they have not made —
 * exactly the runaway a confirmation exists to prevent. On confirmation the
 * turn resumes from the pending card, which is the flow that already ships.
 */
export function shouldContinue(results: LoopStepResult[], stepsTaken: number): boolean {
  if (stepsTaken >= MAX_ACTION_STEPS) {
    return false;
  }
  return !results.some(r => r.status === 'pending_confirmation');
}

/**
 * The tools offered for this turn: every action the user has actually granted.
 *
 * Offering an action the permission service will refuse teaches the model to
 * propose things that always fail, and spends the user's attention on saying
 * no to something they were never going to allow.
 */
export function toolsForTurn(allowedActionIds: readonly string[]): ActionToolDefinition[] {
  return actionToolDefinitions(allowedActionIds);
}
