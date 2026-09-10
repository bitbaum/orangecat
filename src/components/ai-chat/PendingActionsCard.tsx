/**
 * Pending Actions Card
 *
 * Displays pending actions that require user confirmation.
 * Shows in chat when Cat proposes an action.
 *
 * Created: 2026-01-21
 * Last Modified: 2026-01-21
 * Last Modified Summary: Initial implementation
 */

'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import CAT_ACTIONS, { ACTION_CATEGORIES } from '@/config/cat-actions';

interface PendingAction {
  id: string;
  actionId: string;
  category: string;
  parameters: Record<string, unknown>;
  description: string;
  expiresAt: string;
  /** Confirming also allows this category from now on (still confirm-each-time). */
  grantOnConfirm?: boolean;
}

interface PendingActionsCardProps {
  action: PendingAction;
  /** Returns the handler's displayMessage if the action produced one */
  onConfirm: (actionId: string) => Promise<{ message?: string; url?: string }>;
  onReject: (actionId: string) => Promise<void>;
}

const FALLBACK_ICON = FileText;

function formatTimeLeft(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

export function PendingActionsCard({ action, onConfirm, onReject }: PendingActionsCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [completed, setCompleted] = useState<'confirmed' | 'rejected' | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | undefined>(undefined);
  const [confirmUrl, setConfirmUrl] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const Icon =
    CAT_ACTIONS[action.actionId]?.icon ||
    ACTION_CATEGORIES[action.category as keyof typeof ACTION_CATEGORIES]?.icon ||
    FALLBACK_ICON;
  const timeLeft = formatTimeLeft(action.expiresAt);
  const isExpired = timeLeft === 'Expired';

  const handleConfirm = async () => {
    setConfirming(true);
    setActionError(null);
    try {
      const outcome = await onConfirm(action.id);
      setConfirmMessage(outcome.message);
      setConfirmUrl(outcome.url);
      setCompleted('confirmed');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to confirm action');
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    setActionError(null);
    try {
      await onReject(action.id);
      setCompleted('rejected');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reject action');
    } finally {
      setRejecting(false);
    }
  };

  if (completed) {
    return (
      <div
        className={`rounded-md border p-4 ${
          completed === 'confirmed'
            ? 'border-status-positive/20 bg-status-positive-subtle'
            : 'border-subtle bg-surface-raised'
        }`}
      >
        <div className="flex items-center gap-3">
          {completed === 'confirmed' ? (
            <>
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-status-positive" />
              <span className="text-sm font-medium text-fg-primary">
                {confirmMessage ?? 'Action confirmed and executed'}
              </span>
              {confirmUrl && (
                <a
                  href={confirmUrl}
                  className="ml-auto shrink-0 text-sm font-medium text-fg-primary underline underline-offset-2"
                >
                  Open
                </a>
              )}
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-fg-secondary" />
              <span className="text-sm font-medium text-fg-secondary">Action rejected</span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="rounded-md border border-subtle bg-surface-raised p-4">
        <div className="flex items-center gap-3 text-fg-secondary">
          <Clock className="h-5 w-5" />
          <span className="text-sm">This action has expired</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-status-warning/20 bg-status-warning/10 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-surface-page p-2">
          <AlertTriangle className="h-5 w-5 text-status-warning" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-fg-primary">Action requires confirmation</h4>
          <p className="mt-1 text-base text-fg-secondary">{action.description}</p>
          {action.grantOnConfirm && (
            <p className="mt-2 text-sm text-fg-secondary">
              Cat isn’t allowed to handle{' '}
              {ACTION_CATEGORIES[
                action.category as keyof typeof ACTION_CATEGORIES
              ]?.name.toLowerCase() ?? action.category}{' '}
              actions yet. Confirming allows it from now on — you’ll still confirm each one — and
              runs this action.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-fg-secondary">
        <div className="flex items-center gap-1">
          <Icon className="h-4 w-4" />
          <span className="capitalize">{action.actionId.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>{timeLeft}</span>
        </div>
      </div>

      {Object.keys(action.parameters).length > 0 && (
        <div className="rounded-md bg-surface-page/70 p-3 text-xs">
          <div className="mb-1 font-medium text-fg-primary">Details:</div>
          <ul className="space-y-0.5 text-fg-secondary">
            {Object.entries(action.parameters)
              .slice(0, 4)
              .map(([key, value]) => (
                <li key={key}>
                  <span className="opacity-70">{key.replace(/_/g, ' ')}:</span>{' '}
                  <span>
                    {String(value).slice(0, 50)}
                    {String(value).length > 50 ? '...' : ''}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 rounded-md border border-status-negative/20 bg-status-negative/10 px-3 py-2 text-xs text-status-negative">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          onClick={handleConfirm}
          disabled={confirming || rejecting}
          size="sm"
          className="flex-1 bg-fg-primary text-fg-inverted hover:bg-fg-primary/90"
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          {action.grantOnConfirm ? 'Allow and confirm' : 'Confirm'}
        </Button>
        <Button
          onClick={handleReject}
          disabled={confirming || rejecting}
          variant="outline"
          size="sm"
          className="flex-1 border-strong text-fg-primary hover:bg-surface-raised"
        >
          {rejecting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          Reject
        </Button>
      </div>
    </div>
  );
}

// The fetch hook moved to ./usePendingActions.ts (component size gate); kept
// reachable from here so existing imports do not break.
export { usePendingActions } from './usePendingActions';

export default PendingActionsCard;
