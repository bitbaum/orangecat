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
  currentTitle,
  hasCurrentDraft,
}: {
  restored: boolean;
  otherDrafts: LocalArticleDraft[];
  onDiscard: () => boolean;
  onLoad: (draft: LocalArticleDraft) => boolean;
  onDelete: (id: string) => boolean;
  onNew: () => boolean;
  hasOlderDrafts: boolean;
  onRecover: () => void;
  currentTitle?: string;
  hasCurrentDraft?: boolean;
}) {
  const newDraftRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleting, setDeleting] = useState<LocalArticleDraft | 'current' | null>(null);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setLibraryOpen(true)}>
        Drafts
      </Button>
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="[&_button]:min-h-11 [&_button]:min-w-11">
          <DialogHeader>
            <DialogTitle>Your drafts</DialogTitle>
            <DialogDescription>Drafts save on this device, for this account.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            <Button
              ref={newDraftRef}
              type="button"
              variant="outline"
              onClick={() => {
                if (onNew()) {
                  setLibraryOpen(false);
                }
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> New draft
            </Button>
            <p className="text-sm text-fg-secondary [overflow-wrap:anywhere]">
              Current draft: {currentTitle?.trim() || 'Untitled draft'}
            </p>
            <Button type="button" variant="ghost" onClick={() => setLibraryOpen(false)}>
              Return to editor
            </Button>
            {(hasCurrentDraft ?? restored) && (
              <Button
                type="button"
                variant="ghost"
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
                      onClick={() => {
                        if (onLoad(draft)) {
                          setLibraryOpen(false);
                        }
                      }}
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
                      className="min-h-11 w-11 shrink-0 px-0"
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
                <Button type="button" variant="outline" onClick={onRecover}>
                  These are my drafts — recover
                </Button>
              </details>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={open => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <DialogContent
          className="[&_button]:min-h-11 [&_button]:min-w-11"
          onCloseAutoFocus={event => {
            event.preventDefault();
            (triggerRef.current?.isConnected ? triggerRef.current : newDraftRef.current)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-10 [overflow-wrap:anywhere]">
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
    </>
  );
}
