'use client';

/**
 * Confirmation for deleting several posts at once.
 *
 * Lifted out of TimelineComponent, which was doing feed state, selection,
 * infinite scroll AND this modal. Deleting is the one irreversible thing the
 * timeline offers, so its wording lives in one place rather than inline among
 * the scroll sentinel and the empty state.
 *
 * The modal mechanics are ConfirmDialog's (Radix). This file used to be a bare
 * `fixed inset-0` div: no focus trap, no body scroll lock, and no Escape — so
 * a keyboard user could not dismiss it at all, while the single-post dialog
 * next door closed on Escape. Two irreversible actions, two behaviours.
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface BulkDeleteConfirmDialogProps {
  count: number;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const BulkDeleteConfirmDialog: React.FC<BulkDeleteConfirmDialogProps> = ({
  count,
  isProcessing,
  onCancel,
  onConfirm,
}) => (
  <ConfirmDialog
    isOpen
    onClose={onCancel}
    onConfirm={onConfirm}
    isLoading={isProcessing}
    confirmLabel={isProcessing ? 'Deleting…' : 'Delete'}
    title={`Delete ${count} ${count === 1 ? 'post' : 'posts'}?`}
    description={`This cannot be undone. ${
      count === 1 ? 'It' : 'They'
    } will be permanently removed from your timeline.`}
    icon={
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-status-negative/20 bg-status-negative/10">
        <Trash2 className="h-6 w-6 text-status-negative" />
      </div>
    }
  />
);

export default BulkDeleteConfirmDialog;
