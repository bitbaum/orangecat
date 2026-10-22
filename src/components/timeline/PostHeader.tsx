'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Lock, Users, Pencil, Trash2 } from 'lucide-react';
import { TimelineDisplayEvent } from '@/types/timeline';
import { formatRelativeTime } from '@/utils/dates';
// The timeline has its own compact age format; the generic one reads as prose
// ("about 23 hours ago") inside a metadata line.
import { getTimeAgo } from '@/services/timeline/formatters';
import { TIMELINE_SURFACE } from '@/config/timeline';
import { CAT_USERNAME } from '@/config/cat-identity';
import { normalizeUsername } from '@/config/usernames';
import { useDisplayDate } from '@/hooks/useDisplayDate';

interface PostHeaderProps {
  event: TimelineDisplayEvent;
  showMenu?: boolean;
  onMenuToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  isSimpleRepost?: boolean;
}

export function PostHeader({
  event,
  showMenu,
  onMenuToggle,
  onEdit,
  onDelete,
  canEdit,
  isSimpleRepost,
}: PostHeaderProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // The tooltip is a string on an attribute, so it cannot be <FormattedDate />.
  const { formatDateTime } = useDisplayDate();

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onMenuToggle?.();
      }
    };

    // Use setTimeout to avoid immediate trigger from the toggle click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu, onMenuToggle]);

  // For simple reposts, show the original author instead of the reposter
  const rawAuthor = isSimpleRepost
    ? {
        id: event.metadata?.original_actor_id || event.actor?.id,
        name: event.metadata?.original_actor_name || event.actor?.name,
        username: event.metadata?.original_actor_username || event.actor?.username,
        avatar: event.metadata?.original_actor_avatar || event.actor?.avatar,
      }
    : event.actor;
  const displayAuthor = {
    id: rawAuthor?.id ?? '',
    name: rawAuthor?.name ?? 'Unknown',
    username: rawAuthor?.username ?? rawAuthor?.id ?? '',
    avatar: rawAuthor?.avatar,
  };

  const isCatAuthored =
    normalizeUsername(displayAuthor.username || '') === normalizeUsername(CAT_USERNAME) ||
    event.metadata?.is_cat_reply === true;

  // TimelineDisplayEvent extends TimelineEvent which has eventTimestamp, createdAt, updatedAt
  // Use eventTimestamp as primary, fallback to createdAt for backward compatibility
  const timestamp = event.eventTimestamp || event.createdAt;
  const updatedTimestamp = event.updatedAt;
  const isEdited = updatedTimestamp && updatedTimestamp !== timestamp;

  return (
    <div className="flex items-center gap-2">
      {/* User Info - X-style inline */}
      <Link
        href={`/profiles/${displayAuthor.username}`}
        className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-1 text-sm text-fg-primary hover:underline"
        onClick={e => e.stopPropagation()}
      >
        <span className="break-words font-semibold">{displayAuthor.name}</span>
        <span className="break-all text-fg-secondary">@{displayAuthor.username}</span>
      </Link>

      {/* Written by the platform's agent, said out loud.
          `is_cat_reply` was already being written onto every Cat reply, with a
          comment saying it existed "so the UI can render a Cat reply
          distinctly" — and nothing read it. Two writers, no reader, so a Cat
          answer was indistinguishable from a person's unless you recognised the
          handle.
          The author is the primary signal because it is the fact that matters
          (this was written by the agent); the metadata flag is honoured too so
          a reply stays marked even if it is ever re-attributed. */}
      {isCatAuthored && (
        <span className="flex-shrink-0 rounded-sm bg-surface-raised px-1.5 py-0.5 text-2xs font-medium uppercase tracking-caps text-fg-secondary">
          AI
        </span>
      )}

      {/* Timestamp */}
      <time
        dateTime={timestamp}
        className="shrink-0 whitespace-nowrap text-xs text-fg-secondary"
        title={timestamp ? formatDateTime(timestamp) : undefined}
      >
        {timestamp ? getTimeAgo(timestamp) : ''}
      </time>

      {/* Visibility Indicator */}
      {event.visibility === 'private' && (
        <span title="Only you can see this">
          <Lock className="w-3.5 h-3.5 text-fg-tertiary" />
        </span>
      )}
      {event.visibility === 'followers' && (
        <span title="Followers only">
          <Users className="w-3.5 h-3.5 text-fg-tertiary" />
        </span>
      )}

      {/* Edited indicator */}
      {isEdited && (
        <span
          className="text-fg-tertiary text-xs"
          title={updatedTimestamp ? `Edited ${formatRelativeTime(updatedTimestamp)}` : 'Edited'}
        >
          · edited
        </span>
      )}

      {/* Menu Button - moved to end of line */}
      {canEdit && onMenuToggle && (
        <div className="relative ml-auto" ref={menuRef}>
          <button
            onClick={e => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className={`${TIMELINE_SURFACE.iconButton} -mr-1.5`}
            aria-label="Post options"
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div
              className={`absolute right-0 top-full z-50 mt-1 w-48 ${TIMELINE_SURFACE.menu}`}
              role="menu"
            >
              <div className="py-1">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-fg-primary hover:bg-surface-raised flex items-center gap-3"
                  role="menuitem"
                >
                  <Pencil className="w-4 h-4" />
                  Edit post
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDelete?.();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-status-negative hover:bg-status-negative/10 flex items-center gap-3"
                  role="menuitem"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete post
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PostHeader;
