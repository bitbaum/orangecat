/**
 * Running the actions a model asked for in PROSE.
 *
 * Extracted from `chat-orchestrator` so the local path can use it. It was
 * module-private there, which is exactly why /api/cat/local-complete had no
 * executor and a local model's Cat could not do anything (ADR-0008 D2): the
 * capability existed, one file away, behind no decision at all.
 *
 * WHO is allowed to cause an action is not decided here. Every call goes
 * through `CatActionExecutor.executeAction`, so permission checks, spend caps,
 * the confirmation flow and the `cat_action_log` row behave identically to the
 * hosted path. This function only turns parsed blocks into executions and
 * results into something the caller can render.
 */
import { createActionExecutor } from '@/services/cat';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ExecAction, CatAction, ExecActionResult } from '@/types/cat';

/**
 * Ceiling on how many actions ONE reply may fire.
 *
 * The hosted loop is bounded by `MAX_ACTION_STEPS` because the server runs it.
 * On the local path the browser drives each step, so the per-reply count is the
 * only bound this side of the rate limiter — and the rate limiter counts
 * requests, not the actions inside one. Six matches the hosted ceiling so the
 * two paths cannot differ in what a single turn is allowed to do.
 */
export const MAX_ACTIONS_PER_REPLY = 6;

/**
 * Execute all exec_action blocks parsed from an AI response.
 *
 * Actions with `requiresConfirmation` create pending actions in the DB rather
 * than running; the rest run immediately. Results are returned for the caller
 * to hand back to the client, because an action the user cannot see happened
 * is worse than one that did not run.
 */
export async function runExecActions(
  supabase: AnySupabaseClient,
  userId: string,
  actorId: string | null,
  actions: CatAction[]
): Promise<ExecActionResult[]> {
  const execActions = actions
    .filter((a): a is ExecAction => a.type === 'exec_action')
    .slice(0, MAX_ACTIONS_PER_REPLY);
  if (execActions.length === 0) {
    return [];
  }
  if (!actorId) {
    return execActions.map(a => ({
      actionId: a.actionId,
      status: 'failed' as const,
      code: 'unknown' as const,
      error: 'User has no actor record',
    }));
  }

  const executor = createActionExecutor(supabase);
  const results: ExecActionResult[] = [];

  for (const action of execActions) {
    try {
      const result = await executor.executeAction(userId, actorId, {
        actionId: action.actionId,
        parameters: action.parameters,
      });
      // Handlers attach a user-facing sentence as data.displayMessage.
      const handlerData = result.data as Record<string, unknown> | undefined;
      const displayMessage =
        typeof handlerData?.displayMessage === 'string' ? handlerData.displayMessage : undefined;
      results.push({
        actionId: action.actionId,
        status:
          result.status === 'completed'
            ? 'completed'
            : result.status === 'pending_confirmation'
              ? 'pending_confirmation'
              : 'failed',
        data: result.data,
        displayMessage,
        code: result.code,
        error: result.error,
        pendingActionId: result.pendingActionId,
      });
    } catch (err) {
      results.push({
        actionId: action.actionId,
        status: 'failed',
        code: 'unknown',
        error: err instanceof Error ? err.message : 'Execution error',
      });
    }
  }

  return results;
}
