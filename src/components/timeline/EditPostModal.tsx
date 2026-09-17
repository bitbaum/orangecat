'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, Lock, Loader2 } from 'lucide-react';
import { TimelineDisplayEvent, TimelineVisibility } from '@/types/timeline';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { TIMELINE_CONTENT_LIMITS, TIMELINE_COPY, TIMELINE_SURFACE } from '@/config/timeline';
import { formatNumber } from '@/utils/locale';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: TimelineDisplayEvent;
  onSave: (updates: {
    title: string;
    description: string;
    visibility: TimelineVisibility;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function EditPostModal({
  isOpen,
  onClose,
  event,
  onSave,
  isSaving = false,
}: EditPostModalProps) {
  const [content, setContent] = useState(event.description || event.title || '');
  const [visibility, setVisibility] = useState<TimelineVisibility>(event.visibility || 'public');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens with new event
  useEffect(() => {
    if (isOpen) {
      setContent(event.description || event.title || '');
      setVisibility(event.visibility || 'public');
      setError(null);
    }
  }, [isOpen, event]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSave = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Post content cannot be empty');
      return;
    }

    if (trimmedContent.length > TIMELINE_CONTENT_LIMITS.editPost) {
      setError(`Post content is too long (max ${TIMELINE_CONTENT_LIMITS.editPost} characters)`);
      return;
    }

    setError(null);

    try {
      const title =
        trimmedContent.length <= TIMELINE_CONTENT_LIMITS.title
          ? trimmedContent
          : `${trimmedContent.slice(0, TIMELINE_CONTENT_LIMITS.titleTruncateAt).trimEnd()}...`;

      await onSave({
        title,
        description: trimmedContent,
        visibility,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Escape to close
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const hasChanges =
    content.trim() !== (event.description || event.title || '').trim() ||
    visibility !== (event.visibility || 'public');

  const charCount = content.length;
  const maxChars = TIMELINE_CONTENT_LIMITS.editPost;
  const isOverLimit = charCount > maxChars;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-page/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl rounded-md border border-subtle bg-surface-page shadow-sm animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header — dismissal only. The action that commits the edit lives at
            the end of the form, next to the character count that says whether
            it is allowed, rather than diagonally opposite it. */}
        <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
          <button onClick={onClose} className={TIMELINE_SURFACE.iconButton} aria-label="Close">
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-semibold text-fg-primary">Edit post</h2>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-3 p-3 oc-error-surface rounded-lg text-sm text-status-negative/80"
            >
              {error}
            </div>
          )}

          {/* Textarea */}
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={TIMELINE_COPY.composePlaceholder}
            className={cn(
              'min-h-[150px] text-base leading-relaxed border-none bg-transparent p-0 focus:ring-0 resize-none placeholder:text-fg-secondary',
              isOverLimit && 'text-status-negative'
            )}
            disabled={isSaving}
            autoFocus
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-subtle">
            {/* Visibility selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
                className={cn(
                  TIMELINE_SURFACE.chip,
                  visibility === 'public' ? TIMELINE_SURFACE.chipActive : ''
                )}
                disabled={isSaving}
              >
                {visibility === 'public' ? (
                  <>
                    <Globe className="w-4 h-4" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Private
                  </>
                )}
              </button>
            </div>

            {/* Character count and the commit action, in reading order: what
                you have written, then whether you may save it, then Save. */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'text-sm tabular-nums',
                  isOverLimit ? 'text-status-negative font-medium' : 'text-fg-tertiary'
                )}
              >
                {formatNumber(charCount)} / {formatNumber(maxChars)}
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges || isOverLimit || !content.trim()}
                size="sm"
                className={TIMELINE_SURFACE.buttonPrimary}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    {TIMELINE_COPY.savingButton}
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditPostModal;
