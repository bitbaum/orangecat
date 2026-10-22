'use client';

import { useState } from 'react';
import { Brain, ChevronRight, Undo2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import type { MemoryNote } from '../hooks/useMemoryNotes';

interface MemoryNoteCardProps {
  notes: MemoryNote[];
  onUndo: (id: string) => Promise<boolean>;
  onDismiss: (id: string) => void;
}

/** Visible memory writes, with individual undo and a compact multi-fact disclosure. */
export function MemoryNoteCard({ notes, onUndo, onDismiss }: MemoryNoteCardProps) {
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  async function undo(id: string) {
    setUndoingIds(previous => new Set(previous).add(id));
    setFailedIds(previous => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    try {
      if (!(await onUndo(id))) {
        setFailedIds(previous => new Set(previous).add(id));
      }
    } catch {
      setFailedIds(previous => new Set(previous).add(id));
    } finally {
      setUndoingIds(previous => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }

  if (!notes.length) {
    return null;
  }

  const content = (
    <>
      <ul className="space-y-2">
        {notes.map(note => {
          const busy = undoingIds.has(note.id);
          return (
            <li
              key={note.id}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1"
            >
              <span className="min-w-0 break-words text-sm text-fg-primary">“{note.content}”</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isLoading={busy}
                  onClick={() => void undo(note.id)}
                  aria-label={`Undo memory: ${note.content}`}
                >
                  {!busy && <Undo2 className="h-3.5 w-3.5" aria-hidden />}
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-11 px-0"
                  disabled={busy}
                  onClick={() => onDismiss(note.id)}
                  aria-label={`Keep memory and dismiss: ${note.content}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              {failedIds.has(note.id) && (
                <p role="alert" className="col-span-2 text-xs text-status-negative">
                  Couldn’t confirm removal. Try Undo again.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Button href={ROUTES.SETTINGS_MEMORY} variant="ghost" size="sm" className="mt-1">
        Review memories
      </Button>
    </>
  );

  return (
    <div className="rounded-md border border-subtle bg-surface-raised px-3 py-2">
      {notes.length > 1 ? (
        <details className="group/memory">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-fg-secondary">
            <Brain className="h-4 w-4 shrink-0" aria-hidden />
            Cat noted {notes.length} details
            <ChevronRight
              className="ml-auto h-4 w-4 transition-transform group-open/memory:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="pt-2">{content}</div>
        </details>
      ) : (
        <>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-fg-secondary">
            <Brain className="h-3.5 w-3.5" aria-hidden />
            Cat noted
          </p>
          {content}
        </>
      )}
    </div>
  );
}
