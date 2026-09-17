'use client';

/**
 * Confirmation for deleting one post.
 *
 * The modal mechanics are ConfirmDialog's (Radix): focus trap, Escape, body
 * scroll lock, backdrop. This file used to hand-roll the Escape key and the
 * scroll lock and still had no focus trap — while the sibling bulk-delete
 * dialog hand-rolled neither, so the two irreversible actions on the timeline
 * behaved differently for a keyboard user.
 */

import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TIMELINE_SURFACE } from '@/config/timeline';

interface DeletePostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
  postPreview?: string;
}

export function DeletePostDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  postPreview,
}: DeletePostDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isDeleting}
      confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
      title="Delete post?"
      description="This can't be undone and it will be removed from your profile, the timeline, and search results."
      icon={
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-status-negative/20 bg-status-negative/10">
          <AlertTriangle className="h-6 w-6 text-status-negative" />
        </div>
      }
    >
      {postPreview && (
        <p
          className={`${TIMELINE_SURFACE.chip} line-clamp-3 rounded-md p-3 text-sm text-fg-secondary`}
        >
          {postPreview}
        </p>
      )}
    </ConfirmDialog>
  );
}

export default DeletePostDialog;
