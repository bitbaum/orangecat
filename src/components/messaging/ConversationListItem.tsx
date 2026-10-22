'use client';

import { formatRelativeTime } from '@/utils/dates';
import { Users, MessageSquare, Trash2 } from 'lucide-react';
import AvatarLink from '@/components/ui/AvatarLink';
import { cn } from '@/lib/utils';
import {
  getConversationDisplayName,
  getOtherParticipants,
} from '@/features/messaging/lib/conversation-display';
import type { Conversation } from '@/features/messaging/types';

function getConversationAvatar(
  conversation: Conversation,
  currentUserId: string | undefined
): React.ReactNode {
  const others = getOtherParticipants(conversation, currentUserId);

  if (conversation.is_group) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-subtle bg-surface-raised text-fg-primary">
        <Users className="w-5 h-5" />
      </div>
    );
  }

  if (others.length >= 1) {
    const p = others[0];
    return (
      <AvatarLink
        username={p?.username && typeof p.username === 'string' ? p.username : null}
        userId={p?.user_id && typeof p.user_id === 'string' ? p.user_id : null}
        avatarUrl={p?.avatar_url && typeof p.avatar_url === 'string' ? p.avatar_url : null}
        name={p?.name && typeof p.name === 'string' ? p.name : null}
        size={40}
        className="flex-shrink-0"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-raised">
      <MessageSquare className="w-5 h-5 text-fg-secondary" />
    </div>
  );
}

export interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isActiveConversation: boolean;
  selectionMode: boolean;
  currentUserId: string | undefined;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerEnter: () => void;
  onPointerUp: () => void;
  onClick: () => void;
  onToggleSelect: () => void;
  onDeleteRequest: () => void;
}

export function ConversationListItem({
  conversation,
  isSelected,
  isActiveConversation,
  selectionMode,
  currentUserId,
  onPointerDown,
  onPointerEnter,
  onPointerUp,
  onClick,
  onToggleSelect,
  onDeleteRequest,
}: ConversationListItemProps) {
  const displayName = getConversationDisplayName(conversation, currentUserId);

  return (
    <div
      onPointerDown={event => {
        if (!(event.target as Element).closest('a,button,input')) {
          onPointerDown(event);
        }
      }}
      onPointerEnter={onPointerEnter}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={event => {
        if (!(event.target as Element).closest('a,button,input')) {
          onClick();
        }
      }}
      className={cn(
        'group flex cursor-pointer items-start gap-3 p-3 transition-colors duration-150 hover:bg-surface-raised/50 sm:p-4',
        isActiveConversation && 'border-l-2 border-fg-primary bg-surface-raised',
        selectionMode && 'pr-3'
      )}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="mt-2"
          aria-label={`Select conversation with ${displayName}`}
        />
      )}
      {getConversationAvatar(conversation, currentUserId)}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClick}
                aria-label={`${selectionMode ? 'Select' : 'Open'} conversation with ${displayName}`}
                aria-current={isActiveConversation ? 'page' : undefined}
                className="min-h-11 min-w-0 flex-1 break-words rounded-md text-left text-base font-semibold text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {displayName}
              </button>
              {conversation.unread_count > 0 && (
                <span
                  aria-label={`${conversation.unread_count} unread messages`}
                  className="rounded-sm bg-fg-primary px-2 py-0.5 text-[11px] leading-4 text-fg-inverted"
                >
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm text-fg-secondary">
              {conversation.last_message_preview || 'No messages yet'}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-fg-tertiary">
              <span>
                {conversation.last_message_at
                  ? formatRelativeTime(conversation.last_message_at)
                  : 'No messages'}
              </span>
              {conversation.is_group && <span>{conversation.participants.length} members</span>}
            </div>
          </div>
          {!selectionMode && (
            <button
              type="button"
              aria-label="Delete conversation"
              className="p-1 min-h-11 min-w-11 flex items-center justify-center rounded-md text-fg-tertiary hover:text-status-negative hover:bg-status-negative/10 self-start"
              onClick={e => {
                e.stopPropagation();
                onDeleteRequest();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
