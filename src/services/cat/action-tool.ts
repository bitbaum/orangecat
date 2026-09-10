/**
 * Running a Cat action as a tool call.
 *
 * ADR-0006 D2. The bridge between "the model called a tool" and "the action
 * executor ran it" — extracted from tool-executor.ts, which crossed its size
 * limit when this arrived. Cohesive on its own: everything here is about
 * turning one tool call into one executed action and one sentence the model
 * can read.
 *
 * Nothing here decides whether an action is ALLOWED. That stays in
 * CatActionExecutor, which owns permissions, spend caps, confirmation and the
 * cat_action_log row.
 */

import { CAT_ACTIONS } from '@/config/cat-actions';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CatActionExecutor } from './action-executor';
import { summariseForModel } from './action-loop';
import { PLATFORM_TOOL_DEFINITION } from './tool-use-detection';
import type { OnToolCall, RawToolCall } from './tool-use-types';

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
 * Does this tool name belong to the action registry rather than a read tool?
 *
 * PRECEDENCE MATTERS. `forget_memories` exists in BOTH worlds, and the two do
 * different things: the read tool clears the memory store AND the profile and
 * reports the union; the action does less. Checking the registry first
 * silently rerouted every forget to the weaker one, which three existing tests
 * caught. Read tools win; only names they do not claim fall through here.
 */
export function isActionToolName(toolName: string | undefined): boolean {
  return !!toolName && !PLATFORM_TOOL_NAMES.has(toolName) && !!CAT_ACTIONS[toolName];
}
