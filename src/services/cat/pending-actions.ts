/**
 * Writing a consent card: the cat_pending_actions row the Cat chat shows with
 * Confirm / Reject (PendingActionsCard). Split out of action-executor.ts so a
 * second caller — the @cat-on-a-post path, which may only ever PROPOSE money
 * actions — writes exactly the same row as the chat does, not a lookalike.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CAT_ACTIONS, type CatAction } from '@/config/cat-actions';
import { DATABASE_TABLES } from '@/config/database-tables';
import { generateActionDescription } from './action-descriptions';
import { findIdenticalPending } from './pending-dedupe';
import { validateActionParameters } from './action-schemas';
import { CatPermissionService } from './permission-service';
import { extractBtcAmount } from './action-log';
import {
  canGrantOnConfirm,
  type ActionRequest,
  type ActionResult,
  type PendingAction,
} from './action-types';

export async function createPendingAction(
  supabase: AnySupabaseClient,
  userId: string,
  action: CatAction,
  parameters: Record<string, unknown>,
  options: { conversationId?: string; messageId?: string; grantOnConfirm?: boolean } = {}
): Promise<PendingAction> {
  const description = generateActionDescription(action, parameters);

  // One consent card per identical request — see findIdenticalPending.
  const same = await findIdenticalPending(supabase, userId, action.id, parameters);
  if (same) {
    return same;
  }

  const { data, error } = await supabase
    .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
    .insert({
      user_id: userId,
      action_id: action.id,
      category: action.category,
      parameters,
      description,
      conversation_id: options.conversationId || null,
      message_id: options.messageId || null,
      grant_on_confirm: options.grantOnConfirm === true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create pending action: ${error.message}`);
  }

  return {
    id: data.id,
    actionId: data.action_id,
    category: data.category,
    parameters: data.parameters,
    description: data.description,
    conversationId: data.conversation_id,
    expiresAt: data.expires_at,
    grantOnConfirm: data.grant_on_confirm === true,
  };
}

/**
 * Put an action in front of the user as a consent card, and NEVER run it.
 *
 * `CatActionExecutor.executeAction` runs an action straight away when the
 * user's settings say it needs no confirmation — right inside their own chat,
 * wrong for a request that arrived any other way (a public post that tagged
 * @cat). This applies the executor's own gates — parameter validation, the
 * permission service, spend caps — and then always stops at the card, whatever
 * the user's autonomy settings say. Confirming it later goes through
 * `confirmPendingAction`, the same path as every other card.
 */
export async function proposeAction(
  supabase: AnySupabaseClient,
  userId: string,
  request: ActionRequest
): Promise<ActionResult> {
  const { actionId, parameters, conversationId, messageId } = request;
  const action = CAT_ACTIONS[actionId];
  if (!action || !action.enabled) {
    return { success: false, code: 'unknown_action', actionId, status: 'failed' };
  }

  const validation = validateActionParameters(actionId, parameters);
  if (!validation.ok) {
    return {
      success: false,
      code: 'invalid_parameters',
      actionId,
      status: 'failed',
      error: validation.error,
    };
  }
  const params = validation.data ?? parameters;

  const permissions = new CatPermissionService(supabase);
  const permission = await permissions.checkPermission(userId, actionId);
  const grantOnConfirm = !permission.allowed && canGrantOnConfirm(action, permission.code);
  if (!permission.allowed && !grantOnConfirm) {
    return {
      success: false,
      code: permission.code ?? 'permission_denied',
      actionId,
      status: 'denied',
      error: permission.reason,
    };
  }

  const spend = await permissions.checkSpendCaps(
    userId,
    actionId,
    extractBtcAmount(action, params)
  );
  if (!spend.allowed) {
    return {
      success: false,
      code: spend.code ?? 'spend_cap_exceeded',
      actionId,
      status: 'denied',
      error: spend.reason,
    };
  }

  const pending = await createPendingAction(supabase, userId, action, params, {
    conversationId,
    messageId,
    grantOnConfirm,
  });
  return { success: true, actionId, status: 'pending_confirmation', pendingActionId: pending.id };
}
