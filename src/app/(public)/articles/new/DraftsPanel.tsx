'use client';

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { LocalArticleDraft } from '@/services/articles/local-drafts';
import { formatRelativeTime } from '@/utils/dates';

/** Device draft library. Recovery is explicit because old storage has no owner. */
export default function DraftsPanel({
  restored,
  otherDrafts,
  onDiscard,
  onLoad,
  onDelete,
  onNew,
  hasOlderDrafts,
  onRecover,
}: {
  restored: boolean;
  otherDrafts: LocalArticleDraft[];
  onDiscard: () => boolean;
  onLoad: (draft: LocalArticleDraft) => void;
  onDelete: (id: string) => boolean;
  onNew: () => void;
  hasOlderDrafts: boolean;
  onRecover: () => void;
}) {
  const newDraftRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleting, setDeleting] = useState<LocalArticleDraft | 'current' | null>(null);
  return (
    <section
      aria-label="Your device drafts"
      className="mb-4 space-y-3 rounded-md border border-subtle p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-secondary">
          {restored ? 'Restored your saved draft.' : 'Drafts save on this device.'}
        </p>
        <Button ref={newDraftRef} type="button" variant="outline" size="sm" onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden />
          New draft
        </Button>
      </div>
      {(restored || otherDrafts.length > 0 || hasOlderDrafts) && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm text-fg-secondary">
            Manage drafts
          </summary>
          <div className="space-y-3">
            {restored && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={event => {
                  triggerRef.current = event.currentTarget;
                  setDeleteFailed(false);
                  setDeleting('current');
                }}
              >
                Discard current draft
              </Button>
            )}
            {otherDrafts.length > 0 && (
              <ul className="divide-y divide-subtle">
                {otherDrafts.map(draft => (
                  <li key={draft.id} className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => onLoad(draft)}
                      className="min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block break-words text-sm text-fg-primary">
                        {draft.title.trim() || 'Untitled draft'}
                      </span>
                      <span className="text-xs text-fg-tertiary">
                        {formatRelativeTime(new Date(draft.updatedAt))}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-11 shrink-0 px-0"
                      aria-label={`Delete draft: ${draft.title.trim() || 'Untitled draft'}`}
                      onClick={event => {
                        triggerRef.current = event.currentTarget;
                        setDeleteFailed(false);
                        setDeleting(draft);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {hasOlderDrafts && (
              <details>
                <summary className="min-h-11 cursor-pointer py-3 text-sm text-fg-secondary">
                  Recover older device drafts
                </summary>
                <p className="mb-2 text-sm text-fg-secondary">
                  Older drafts have no account owner. Recover them into this account only if they
                  belong to you.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onRecover}>
                  These are my drafts — recover
                </Button>
              </details>
            )}
          </div>
        </details>
      )}
      <Dialog
        open={deleting !== null}
        onOpenChange={open => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <DialogContent
          onCloseAutoFocus={event => {
            event.preventDefault();
            (triggerRef.current?.isConnected ? triggerRef.current : newDraftRef.current)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              Delete{' '}
              {deleting === 'current'
                ? 'current draft'
                : deleting?.title.trim() || 'untitled draft'}
              ?
            </DialogTitle>
            <DialogDescription>
              This removes this draft from this device. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteFailed && (
            <p role="alert" className="text-sm text-status-negative">
              Could not delete this draft. Your writing is still here. Try again.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Keep draft
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (deleting && (deleting === 'current' ? onDiscard() : onDelete(deleting.id))) {
                  setDeleting(null);
                } else {
                  setDeleteFailed(true);
                }
              }}
            >
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
