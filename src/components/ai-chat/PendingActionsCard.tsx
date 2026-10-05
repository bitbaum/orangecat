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
import type { PendingAction } from './usePendingActions';

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

  // What the action is about, when the Cat named it — "Der HochhinHouse Party
  // RENNER" says more than "Execute Build a Website" alone.
  const subject =
    typeof action.parameters.title === 'string' && action.parameters.title.trim()
      ? action.parameters.title.trim()
      : null;
  const details = Object.entries(action.parameters).filter(([key]) => key !== 'title');

  return (
    <div className="space-y-3 rounded-lg border border-default border-l-4 border-l-status-warning bg-surface-base p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-fg-secondary">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Your Cat asks first</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {timeLeft}
        </span>
      </div>

      <div className="min-w-0">
        <h4 className="font-medium text-fg-primary">{action.description}</h4>
        {subject && <p className="mt-0.5 break-words text-sm text-fg-secondary">{subject}</p>}
        {action.grantOnConfirm && (
          <p className="mt-2 text-sm text-fg-secondary">
            Cat isn’t allowed to handle{' '}
            {ACTION_CATEGORIES[
              action.category as keyof typeof ACTION_CATEGORIES
            ]?.name.toLowerCase() ?? action.category}{' '}
            actions yet. Confirming allows it from now on — you’ll still confirm each one — and runs
            this action.
          </p>
        )}
      </div>

      {details.length > 0 && (
        <details className="text-xs text-fg-secondary">
          <summary className="min-h-9 cursor-pointer select-none py-2 font-medium text-fg-primary">
            Details
          </summary>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-surface-raised p-3">
            {details.slice(0, 6).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="opacity-70">{key.replace(/_/g, ' ')}</dt>
                <dd className="min-w-0 break-words">
                  {String(value).slice(0, 80)}
                  {String(value).length > 80 ? '…' : ''}
                </dd>
              </div>
            ))}
          </dl>
        </details>
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
export type { PendingAction } from './usePendingActions';

export default PendingActionsCard;
