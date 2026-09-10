/**
 * A Cat action, called as a tool.
 *
 * ADR-0006 D2. Actions used to be scraped out of the model's FINISHED text and
 * fired afterwards, so the model could never see what happened and the prompt
 * had to forbid it from saying "done". Here the action runs first and its
 * outcome goes back as the tool result, so the reply is written knowing.
 *
 * Every gate still lives in CatActionExecutor: permissions, spend caps,
 * confirmation, the cat_action_log row. This changes WHEN the model learns the
 * outcome, not who may cause it.
 */

import { logger } from '@/utils/logger';
import { CAT_ACTIONS } from '@/config/cat-actions';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { PLATFORM_TOOL_DEFINITION } from './tool-use-detection';
import { CatActionExecutor } from './action-executor';
import { summariseForModel } from './action-loop';
import type { OnToolCall, RawToolCall } from './tool-use-types';

/**
 * Execute one action tool call and return the sentence the model reads next.
 *
 * Failures are returned as text, never thrown: a failed action must leave the
 * model able to tell the user about it, which is strictly better than a dead
 * stream.
 */
/** Names the read-tool handlers in this file already own. */
const PLATFORM_TOOL_NAMES = new Set(
  PLATFORM_TOOL_DEFINITION.map(t => (t as { function: { name: string } }).function.name)
);

export async function runActionAsTool(
  supabase: AnySupabaseClient,
  userId: string,
  actorId: string | null,
  toolCall: RawToolCall,
  onToolCall?: OnToolCall
): Promise<string> {
  const actionId = toolCall.function?.name as string;
  onToolCall?.({ id: toolCall.id, name: actionId, status: 'running' });

  if (!actorId) {
    return summariseForModel(actionId, {
      status: 'failed',
      error: 'No actor record for this user, so nothing can be created yet.',
    });
  }

  let parameters: Record<string, unknown> = {};
  try {
    parameters = JSON.parse(toolCall.function?.arguments ?? '{}') as Record<string, unknown>;
  } catch {
    // Malformed JSON from the model is a correctable mistake, not a crash.
    return summariseForModel(actionId, {
      status: 'failed',
      error: 'Arguments were not valid JSON. Send them again as a JSON object.',
    });
  }

  try {
    const executor = new CatActionExecutor(supabase);
    const result = await executor.executeAction(userId, actorId, { actionId, parameters });
    // The client renders these live. A denial or a pending confirmation is
    // NOT a completion — surfacing it as one would show a green tick for
    // something the user still has to approve.
    onToolCall?.(
      result.status === 'completed'
        ? { id: toolCall.id, name: actionId, status: 'completed', resultCount: 1, results: [] }
        : { id: toolCall.id, name: actionId, status: 'failed', error: result.error }
    );
    return summariseForModel(actionId, result);
  } catch (error) {
    logger.error('Action tool call threw', { error, actionId }, 'CatToolExecutor');
    onToolCall?.({ id: toolCall.id, name: actionId, status: 'failed' });
    return summariseForModel(actionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

/**
 * PRECEDENCE MATTERS. `forget_memories` exists in BOTH worlds — as a read tool
 * and as a registry action — and the two do different things: the tool clears
 * the memory store AND the profile and reports the union, the action does less.
 * Checking actions first silently rerouted it to the weaker one, which three
 * existing tests caught. The read tools win; only names they do not claim fall
 * through to the registry.
 */
export function isCatActionTool(toolName: string | undefined): toolName is string {
  return !!toolName && !PLATFORM_TOOL_NAMES.has(toolName) && !!CAT_ACTIONS[toolName];
}
