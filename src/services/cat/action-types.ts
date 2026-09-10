/**
 * Shapes shared by the executor, its HTTP routes and the chat UI — split out
 * so action-executor.ts stays under the service size limit as the consent
 * card grew (grant-on-confirm, 2026-09-10).
 */

import type { CatAction, ActionCategory } from '@/config/cat-actions';
import type { AiErrorCode } from '@/config/ai-errors';

export interface ActionRequest {
  actionId: string;
  parameters: Record<string, unknown>;
  conversationId?: string;
  messageId?: string;
}

export interface ActionResult {
  success: boolean;
  actionId: string;
  status: 'completed' | 'failed' | 'pending_confirmation' | 'denied';
  data?: unknown;
  /** Why it failed, as a code the UI resolves into copy + a fix link. */
  code?: AiErrorCode;
  error?: string;
  pendingActionId?: string;
  logId?: string;
}

export interface PendingAction {
  id: string;
  actionId: string;
  category: ActionCategory;
  parameters: Record<string, unknown>;
  description: string;
  conversationId?: string;
  expiresAt: string;
  /**
   * Confirming also grants the action's category (still confirm-each-time).
   * The card says so; this is what lets it say so truthfully.
   */
  grantOnConfirm?: boolean;
}

/**
 * Which denials become a consent card instead of a dead end.
 *
 * A category that was never granted is a question the user has not been
 * asked, not a decision they took — so ask, on the card, in the moment. Money
 * and high-risk actions are excluded: one tap must never unlock send_payment.
 */
export function canGrantOnConfirm(
  action: Pick<CatAction, 'category' | 'riskLevel'>,
  code: string | undefined
): boolean {
  return (
    code === 'permission_denied' && action.category !== 'payments' && action.riskLevel !== 'high'
  );
}
