/**
 * My Cat Action Executor — runs actions after permission verification.
 * Handlers live in ./handlers/ by category; shared types in ./action-types.
 */

import { validateActionParameters } from './action-schemas';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CAT_ACTIONS, type CatAction } from '@/config/cat-actions';
import { CatPermissionService } from './permission-service';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import { ACTION_HANDLERS } from './handlers';
import { generateActionDescription } from './action-descriptions';
import { findIdenticalPending } from './pending-dedupe';
import { extractBtcAmount, getActionHistory, logDeniedAction, updateActionLog } from './action-log';

// Re-export parseReminderDate for back-compat (legacy tests import from here).
export { parseReminderDate } from './handlers/date-utils';

import {
  canGrantOnConfirm,
  type PendingAction,
  type ActionRequest,
  type ActionResult,
} from './action-types';
export { canGrantOnConfirm, type PendingAction, type ActionRequest, type ActionResult };

// ==================== EXECUTOR SERVICE ====================

export class CatActionExecutor {
  private permissionService: CatPermissionService;

  constructor(private supabase: AnySupabaseClient) {
    this.permissionService = new CatPermissionService(supabase);
  }

  /**
   * Execute an action on behalf of a user
   */
  async executeAction(
    userId: string,
    actorId: string,
    request: ActionRequest
  ): Promise<ActionResult> {
    const { actionId, parameters, conversationId, messageId } = request;

    // 1. Validate action exists
    const action = CAT_ACTIONS[actionId];
    if (!action) {
      return {
        success: false,
        code: 'unknown_action',
        actionId,
        status: 'failed',
        error: `Unknown action: ${actionId}`,
      };
    }

    if (!action.enabled) {
      return {
        success: false,
        code: 'action_disabled',
        actionId,
        status: 'failed',
        error: `Action is disabled: ${actionId}`,
      };
    }

    // 1b. Validate parameters against the registry's own declaration
    // (ADR-0006 D4). This ran nowhere before: the API schema is
    // `z.record(unknown)` and model JSON went straight to the handler, so a
    // missing required field surfaced as whatever that handler threw.
    //
    // Deliberately BEFORE the permission check. Malformed input is not a
    // permission story, and an audit row saying "denied" would misattribute a
    // typo to the user's grants. Nothing has been written at this point, so
    // rejecting here costs nothing and — with the in-turn loop — hands the
    // model a sentence it can correct on the next step.
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
    const validatedParameters = validation.data ?? parameters;

    // 2. Check permission
    const permission = await this.permissionService.checkPermission(userId, actionId);

    if (!permission.allowed && canGrantOnConfirm(action, permission.code)) {
      const pendingAction = await this.createPendingAction(
        userId,
        action,
        validatedParameters,
        conversationId,
        messageId,
        { grantOnConfirm: true }
      );
      return {
        success: true,
        actionId,
        status: 'pending_confirmation',
        pendingActionId: pendingAction.id,
        data: {
          description: generateActionDescription(action, validatedParameters),
          pendingAction,
        },
      };
    }

    if (!permission.allowed) {
      const reason = permission.reason || 'Permission denied';
      // Denials are audit rows too — without them the track record only ever
      // sees wins, and the Cat re-proposes its losses forever.
      await logDeniedAction(this.supabase, {
        userId,
        action,
        parameters: validatedParameters,
        reason,
        conversationId,
        messageId,
      });
      return {
        success: false,
        code: permission.code ?? 'permission_denied',
        actionId,
        status: 'denied',
        error: reason,
      };
    }

    // 2b. Enforce BTC spend caps early so the user isn't asked to confirm a
    // payment that will be denied anyway. performAction re-checks as the
    // enforcement backstop (caps/budget can change between propose and confirm).
    const spendCheck = await this.permissionService.checkSpendCaps(
      userId,
      actionId,
      extractBtcAmount(action, validatedParameters)
    );
    if (!spendCheck.allowed) {
      const reason = spendCheck.reason || 'Spend cap exceeded';
      await logDeniedAction(this.supabase, {
        userId,
        action,
        parameters: validatedParameters,
        reason,
        conversationId,
        messageId,
      });
      return {
        success: false,
        code: spendCheck.code ?? 'spend_cap_exceeded',
        actionId,
        status: 'denied',
        error: reason,
      };
    }

    // 3. If confirmation required, create pending action
    if (permission.requiresConfirmation) {
      const pendingAction = await this.createPendingAction(
        userId,
        action,
        validatedParameters,
        conversationId,
        messageId
      );

      return {
        success: true,
        actionId,
        status: 'pending_confirmation',
        pendingActionId: pendingAction.id,
        data: {
          description: generateActionDescription(action, validatedParameters),
          pendingAction,
        },
      };
    }

    // 4. Execute action
    return this.performAction(
      userId,
      actorId,
      action,
      validatedParameters,
      conversationId,
      messageId
    );
  }

  /**
   * Confirm and execute a pending action
   */
  async confirmPendingAction(
    userId: string,
    actorId: string,
    pendingActionId: string
  ): Promise<ActionResult> {
    const { data: pending, error: fetchError } = await this.supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .select('*')
      .eq('id', pendingActionId)
      .eq('user_id', userId)
      .eq('status', STATUS.CAT_PENDING_ACTIONS.PENDING)
      .single();

    if (fetchError || !pending) {
      return {
        success: false,
        actionId: '',
        status: 'failed',
        error: 'Pending action not found or already processed',
      };
    }

    if (new Date(pending.expires_at) < new Date()) {
      await this.supabase
        .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
        .update({ status: STATUS.CAT_PENDING_ACTIONS.EXPIRED })
        .eq('id', pendingActionId);

      return {
        success: false,
        actionId: pending.action_id,
        status: 'failed',
        error: 'Action has expired',
      };
    }

    await this.supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .update({
        status: STATUS.CAT_PENDING_ACTIONS.CONFIRMED,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', pendingActionId);

    const action = CAT_ACTIONS[pending.action_id];
    if (!action) {
      return {
        success: false,
        code: 'unknown_action',
        actionId: pending.action_id,
        status: 'failed',
        error: 'Action no longer available',
      };
    }

    // The card said "confirming also allows this from now on". Honour it
    // before running, and only for the category the card named. Confirmation
    // stays required — the grant widens what Cat may propose, not what it may
    // do unasked.
    if (pending.grant_on_confirm && canGrantOnConfirm(action, 'permission_denied')) {
      await this.permissionService.grantCategory(userId, action.category, {
        requiresConfirmation: true,
      });
    }

    return this.performAction(
      userId,
      actorId,
      action,
      pending.parameters,
      pending.conversation_id,
      pending.message_id
    );
  }

  /**
   * Reject a pending action
   */
  async rejectPendingAction(
    userId: string,
    pendingActionId: string,
    reason?: string
  ): Promise<void> {
    await this.supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .update({
        status: STATUS.CAT_PENDING_ACTIONS.REJECTED,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq('id', pendingActionId)
      .eq('user_id', userId);
  }

  /**
   * Get pending actions for a user
   */
  async getPendingActions(userId: string): Promise<PendingAction[]> {
    const { data } = await this.supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .select('*')
      .eq('user_id', userId)
      .eq('status', STATUS.CAT_PENDING_ACTIONS.PENDING)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    return (data || []).map(p => ({
      id: p.id,
      actionId: p.action_id,
      category: p.category,
      parameters: p.parameters,
      description: p.description,
      conversationId: p.conversation_id,
      expiresAt: p.expires_at,
      grantOnConfirm: p.grant_on_confirm === true,
    }));
  }

  /** Recent cat_action_log rows for a user — lives with the log code. */
  getActionHistory(
    userId: string,
    options: { limit?: number; actionId?: string; status?: string } = {}
  ) {
    return getActionHistory(this.supabase, userId, options);
  }

  // ==================== PRIVATE METHODS ====================

  private async performAction(
    userId: string,
    actorId: string,
    action: CatAction,
    parameters: Record<string, unknown>,
    conversationId?: string,
    messageId?: string
  ): Promise<ActionResult> {
    const { data: logEntry, error: logError } = await this.supabase
      .from(DATABASE_TABLES.CAT_ACTION_LOG)
      .insert({
        user_id: userId,
        action_id: action.id,
        category: action.category,
        parameters,
        status: 'executing',
        conversation_id: conversationId || null,
        message_id: messageId || null,
        started_at: new Date().toISOString(),
        amount_btc: extractBtcAmount(action, parameters),
      })
      .select()
      .single();

    if (logError) {
      logger.error('Failed to create action log', { error: logError }, 'CatActionExecutor');
    }

    // Spend-cap backstop: this is the single choke point both the direct and the
    // confirm-pending paths go through. Denials are logged for the audit trail.
    const spendCheck = await this.permissionService.checkSpendCaps(
      userId,
      action.id,
      extractBtcAmount(action, parameters),
      { excludeLogId: logEntry?.id }
    );
    if (!spendCheck.allowed) {
      const reason = spendCheck.reason || 'Spend cap exceeded';
      if (logEntry) {
        await updateActionLog(this.supabase, logEntry.id, 'denied', null, reason);
      }
      return {
        success: false,
        actionId: action.id,
        status: 'denied',
        error: reason,
        logId: logEntry?.id,
      };
    }

    const handler = ACTION_HANDLERS[action.id];
    if (!handler) {
      if (logEntry) {
        await updateActionLog(this.supabase, logEntry.id, 'failed', null, 'No handler for action');
      }

      return {
        success: false,
        actionId: action.id,
        status: 'failed',
        error: `No handler implemented for action: ${action.id}`,
        logId: logEntry?.id,
      };
    }

    try {
      const result = await handler(this.supabase, userId, actorId, parameters);

      if (result.success) {
        if (logEntry) {
          await updateActionLog(this.supabase, logEntry.id, 'completed', result.data);
        }

        return {
          success: true,
          actionId: action.id,
          status: 'completed',
          data: result.data,
          logId: logEntry?.id,
        };
      } else {
        if (logEntry) {
          await updateActionLog(this.supabase, logEntry.id, 'failed', null, result.error);
        }

        return {
          success: false,
          actionId: action.id,
          status: 'failed',
          error: result.error,
          logId: logEntry?.id,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (logEntry) {
        await updateActionLog(this.supabase, logEntry.id, 'failed', null, errorMessage);
      }

      return {
        success: false,
        actionId: action.id,
        status: 'failed',
        error: errorMessage,
        logId: logEntry?.id,
      };
    }
  }

  private async createPendingAction(
    userId: string,
    action: CatAction,
    parameters: Record<string, unknown>,
    conversationId?: string,
    messageId?: string,
    options: { grantOnConfirm?: boolean } = {}
  ): Promise<PendingAction> {
    const description = generateActionDescription(action, parameters);

    // One consent card per identical request — see findIdenticalPending.
    const same = await findIdenticalPending(this.supabase, userId, action.id, parameters);
    if (same) {
      return same;
    }

    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .insert({
        user_id: userId,
        action_id: action.id,
        category: action.category,
        parameters,
        description,
        conversation_id: conversationId || null,
        message_id: messageId || null,
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
}

export function createActionExecutor(supabase: AnySupabaseClient): CatActionExecutor {
  return new CatActionExecutor(supabase);
}
