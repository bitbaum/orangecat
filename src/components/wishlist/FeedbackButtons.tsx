/**
 * Feedback Buttons Component
 *
 * Like/Dislike buttons for wishlist proof feedback.
 * Dislikes require a comment of at least 10 characters.
 *
 * Created: 2026-01-06
 * Last Modified: 2026-01-06
 */

'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { FeedbackButtonsProps } from './types';

const MIN_DISLIKE_COMMENT_LENGTH = 10;

export function FeedbackButtons({
  proofId: _proofId,
  wishlistItemId: _wishlistItemId,
  likes,
  dislikes,
  userFeedback,
  onLike,
  onDislike,
  disabled = false,
  size = 'md',
}: FeedbackButtonsProps) {
  const [showDislikeDialog, setShowDislikeDialog] = useState(false);
  const [dislikeComment, setDislikeComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sizeClasses = {
    sm: 'h-7 text-xs gap-1',
    md: 'h-9 text-sm gap-1.5',
    lg: 'h-11 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const handleLikeClick = () => {
    if (disabled || userFeedback === 'like') {
      return;
    }
    onLike?.();
  };

  const handleDislikeClick = () => {
    if (disabled) {
      return;
    }
    if (userFeedback === 'dislike') {
      return;
    }
    setShowDislikeDialog(true);
  };

  const handleSubmitDislike = async () => {
    if (dislikeComment.length < MIN_DISLIKE_COMMENT_LENGTH) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onDislike?.(dislikeComment);
      setShowDislikeDialog(false);
      setDislikeComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCommentValid = dislikeComment.length >= MIN_DISLIKE_COMMENT_LENGTH;
  const charactersNeeded = MIN_DISLIKE_COMMENT_LENGTH - dislikeComment.length;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Like Button */}
        <Button
          variant={userFeedback === 'like' ? 'primary' : 'outline'}
          size="sm"
          className={cn(
            sizeClasses[size],
            userFeedback === 'like' &&
              'bg-status-positive hover:bg-status-positive/90 text-fg-inverted'
          )}
          onClick={handleLikeClick}
          disabled={disabled}
        >
          <ThumbsUp className={cn(iconSizes[size], userFeedback === 'like' && 'fill-current')} />
          <span>{likes}</span>
        </Button>

        {/* Dislike Button */}
        <Button
          variant={userFeedback === 'dislike' ? 'primary' : 'outline'}
          size="sm"
          className={cn(
            sizeClasses[size],
            userFeedback === 'dislike' &&
              'bg-status-negative hover:bg-status-negative/90 text-fg-inverted'
          )}
          onClick={handleDislikeClick}
          disabled={disabled}
        >
          <ThumbsDown
            className={cn(iconSizes[size], userFeedback === 'dislike' && 'fill-current')}
          />
          <span>{dislikes}</span>
        </Button>
      </div>

      {/* Dislike Comment Dialog */}
      <Dialog open={showDislikeDialog} onOpenChange={setShowDislikeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Why are you disliking this proof?</DialogTitle>
            <DialogDescription>
              Please explain your concerns. This helps maintain trust in the community and gives the
              creator a chance to respond.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Textarea
              placeholder="Explain why you think this proof is not valid..."
              value={dislikeComment}
              onChange={e => setDislikeComment(e.target.value)}
              rows={4}
              maxLength={500}
              className={cn(
                !isCommentValid && dislikeComment.length > 0 && 'border-status-warning'
              )}
            />
            <div className="flex justify-between text-xs text-fg-secondary">
              <span>
                {!isCommentValid ? (
                  <span className="text-status-warning">
                    {charactersNeeded} more character{charactersNeeded !== 1 ? 's' : ''} needed
                  </span>
                ) : (
                  <span className="text-status-positive">Comment ready</span>
                )}
              </span>
              <span>{dislikeComment.length}/500</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDislikeDialog(false);
                setDislikeComment('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleSubmitDislike}
              disabled={!isCommentValid || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
