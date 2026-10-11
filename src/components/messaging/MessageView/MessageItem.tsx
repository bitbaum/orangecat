'use client';

/**
 * Message Item Component
 *
 * Renders a single message bubble with read receipt indicators.
 *
 * @module messaging/MessageView/MessageItem
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Check, CheckCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/features/messaging/types';
import { TIMING, MESSAGE_STATUS } from '@/features/messaging/lib/constants';
import {
  formatMessageTime,
  getDateDividerText as getDividerText,
  shouldShowDateDivider as checkShowDivider,
  isOptimisticMessage,
} from '@/features/messaging/lib/message-utils';

interface MessageItemProps {
  message: Message;
  isCurrentUser: boolean;
  showDateDivider: boolean;
  dateDividerText?: string;
  onLongPress?: (message: Message, position?: { x: number; y: number }) => void;
  isEditing?: boolean;
  onEditSave?: (newContent: string) => void;
  onEditCancel?: () => void;
}

// Re-export for backwards compatibility
export const getDateDividerText = getDividerText;
export const shouldShowDateDivider = checkShowDivider;

/**
 * Get the status icon to display for a message
 */
function MessageStatusIcon({ message }: { message: Message }) {
  // Check status field first, then fallback to is_read/is_delivered flags
  const status = message.status;
  const isRead = status === MESSAGE_STATUS.READ || message.is_read === true;
  const isDelivered =
    status === MESSAGE_STATUS.DELIVERED ||
    message.is_delivered === true ||
    status === MESSAGE_STATUS.SENT;

  // Failed messages
  if (status === MESSAGE_STATUS.FAILED) {
    return <AlertCircle className="h-3 w-3 text-status-negative" aria-label="Failed" />;
  }

  // Pending (optimistic) messages
  if (status === MESSAGE_STATUS.PENDING || isOptimisticMessage(message)) {
    return (
      <div
        className="h-3 w-3 rounded-full border border-strong dark:border-fg-secondary animate-pulse"
        aria-label="Sending"
      />
    );
  }

  // Read messages - double check in tiffany
  if (isRead) {
    return <CheckCheck className="h-3 w-3 text-fg-primary" aria-label="Read" />;
  }

  // Delivered messages - single check
  if (isDelivered) {
    return <Check className="h-3 w-3 text-fg-tertiary" aria-label="Delivered" />;
  }

  // Default: show as delivered (message exists in DB)
  return <Check className="h-3 w-3 text-fg-tertiary" aria-label="Delivered" />;
}

export default function MessageItem({
  message,
  isCurrentUser,
  showDateDivider,
  dateDividerText,
  onLongPress,
  isEditing = false,
  onEditSave,
  onEditCancel,
}: MessageItemProps) {
  const isOptimistic = isOptimisticMessage(message);
  const timerRef = useRef<number | null>(null);
  const [editDraft, setEditDraft] = useState(message.content || '');

  // Reset draft whenever this message enters edit mode
  useEffect(() => {
    if (isEditing) {
      setEditDraft(message.content || '');
    }
  }, [isEditing, message.content]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = editDraft.trim();
        if (trimmed && trimmed !== message.content) {
          onEditSave?.(trimmed);
        } else {
          onEditCancel?.();
        }
      }
      if (e.key === 'Escape') {
        onEditCancel?.();
      }
    },
    [editDraft, message.content, onEditSave, onEditCancel]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!onLongPress) {
        return;
      }
      const touch = e.touches[0];
      const pos = { x: touch.clientX, y: touch.clientY };
      timerRef.current = window.setTimeout(() => onLongPress(message, pos), TIMING.LONG_PRESS_MS);
    },
    [onLongPress, message]
  );

  const clearLongPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <>
      {/* Date Divider */}
      {showDateDivider && dateDividerText && (
        <div className="flex justify-center my-4">
          <div className="bg-surface-raised text-fg-secondary text-xs px-3 py-1 rounded-full">
            {dateDividerText}
          </div>
        </div>
      )}

      {/* Message Bubble */}
      <div className={cn('flex', isCurrentUser ? 'justify-end' : 'justify-start')}>
        <div
          className={cn('max-w-[85%] sm:max-w-[70%]', isOptimistic && 'opacity-70')}
          onContextMenu={e => {
            if (onLongPress) {
              e.preventDefault();
              onLongPress(message, { x: e.clientX, y: e.clientY });
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={clearLongPress}
          onTouchCancel={clearLongPress}
        >
          <div
            className={cn(
              'rounded-lg px-4 py-2',
              isCurrentUser
                ? 'bg-fg-primary text-fg-inverted'
                : 'bg-surface-raised text-fg-primary',
              isEditing && 'p-2'
            )}
          >
            {isEditing ? (
              <div>
                <textarea
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full min-w-0 sm:min-w-[200px] bg-surface-base text-fg-primary text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={Math.min(6, editDraft.split('\n').length + 1)}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={onEditCancel}
                    className="text-sm px-3 py-1.5 min-h-9 pointer-coarse:min-h-11 rounded text-fg-inverted/80 hover:text-fg-inverted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = editDraft.trim();
                      if (trimmed && trimmed !== message.content) {
                        onEditSave?.(trimmed);
                      } else {
                        onEditCancel?.();
                      }
                    }}
                    className="text-sm px-3 py-1.5 min-h-9 pointer-coarse:min-h-11 rounded bg-surface-base text-fg-primary font-medium hover:bg-surface-base/90 dark:hover:bg-surface-base/90"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>

          {/* Timestamp and Read Receipt */}
          <div
            className={cn(
              'flex items-center gap-1 mt-1 text-xs text-fg-secondary',
              isCurrentUser ? 'justify-end' : 'justify-start'
            )}
          >
            <span>{formatMessageTime(message.created_at)}</span>

            {/* Read Receipt Indicators (only for current user's messages) */}
            {isCurrentUser && (
              <div className="flex items-center">
                <MessageStatusIcon message={message} />
              </div>
            )}

            {/* Edited indicator */}
            {message.edited_at && <span className="text-fg-tertiary italic">edited</span>}
          </div>
        </div>
      </div>
    </>
  );
}
