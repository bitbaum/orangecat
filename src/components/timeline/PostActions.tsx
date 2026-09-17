'use client';

import React from 'react';
import { Heart, MessageCircle, Share2, ThumbsDown, Repeat2, type LucideIcon } from 'lucide-react';
import { ShareModal } from '@/components/timeline/ShareModal';
import { TimelineDisplayEvent } from '@/types/timeline';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { cn } from '@/lib/utils';

/**
 * The row of things you can do to a post.
 *
 * Written as data rather than as five near-identical JSX blocks, because that
 * is what it is: the same button with a different icon, count, colour and
 * handler. The duplicated version had already drifted — the reply button
 * carried a `-ml-2` none of the others did, only some had a `title`, and the
 * reply count was computed inline by a three-way fallback IIFE while the rest
 * read a single field. Every one of those is invisible until you look at two
 * of them side by side.
 *
 * Layout follows X, for the reason X does it: the count sits in a fixed-width
 * slot that is reserved whether or not there is a number in it. Rendering `''`
 * for zero — which is what this did — means the row re-flows the moment you
 * like something, and every icon after it slides sideways under the cursor
 * that just clicked. Reserving the space costs nothing and the row never moves.
 *
 * All business logic stays in usePostInteractions. This file decides how the
 * row looks and nothing else.
 */

interface PostActionsProps {
  event: TimelineDisplayEvent;
  onUpdate: (updates: Partial<TimelineDisplayEvent>) => void;
  onAddEvent?: (event: TimelineDisplayEvent) => void;
  onToggleComments?: () => void;
  onRepostClick?: () => void;
  isReposting?: boolean;
}

interface ActionSpec {
  key: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  active: boolean;
  /** Colour once active, and on hover — one accent per action, as X does. */
  accent: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Only where the meaning is not obvious from the icon. */
  title?: string;
  /** The heart and repeat fill when active; share never does. */
  fillWhenActive?: boolean;
}

function ActionButton({ spec }: { spec: ActionSpec }) {
  const { icon: Icon, count, active, accent, fillWhenActive = true } = spec;

  return (
    <button
      type="button"
      onClick={spec.onClick}
      disabled={spec.disabled}
      title={spec.title}
      aria-label={spec.label}
      aria-pressed={active}
      className={cn(
        'group flex items-center gap-1 rounded-md py-1.5 pl-1.5 pr-2 text-sm transition-colors',
        'text-fg-secondary disabled:cursor-not-allowed disabled:opacity-50',
        active ? accent : 'hover:text-fg-primary'
      )}
    >
      {/* The icon gets its own round hover target, so the highlight is a
          consistent circle rather than a rectangle whose width depends on how
          many digits the count happens to have. */}
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
          'group-hover:bg-surface-raised'
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', active && fillWhenActive && 'fill-current')} />
      </span>
      {count !== undefined && (
        // Reserved width, tabular figures: the row cannot reflow when a count
        // appears, changes, or ticks over to two digits.
        <span className="min-w-[1.25rem] text-left text-sm tabular-nums">
          {count > 0 ? count : ''}
        </span>
      )}
    </button>
  );
}

export function PostActions({
  event,
  onUpdate,
  onAddEvent,
  onToggleComments,
  onRepostClick,
  isReposting = false,
}: PostActionsProps) {
  const {
    isLiking,
    handleLike,
    isDisliking,
    handleDislike,
    isSharing,
    shareOpen,
    handleShareOpen,
    handleShareClose,
    handleShareConfirm,
  } = usePostInteractions({ event, onUpdate, onAddEvent });

  // One place decides what a reply count is. It used to be an inline IIFE with
  // three fallbacks in this file only, so any other reader of the same number
  // could disagree with the row rendering it.
  const replyCount =
    event.replyCount ??
    (Array.isArray(event.replies) ? event.replies.length : undefined) ??
    event.commentsCount ??
    0;

  const actions: ActionSpec[] = [
    {
      key: 'reply',
      label: 'Reply',
      icon: MessageCircle,
      count: replyCount,
      active: false,
      accent: 'text-fg-primary',
      onClick: onToggleComments,
    },
    {
      key: 'repost',
      label: 'Repost',
      icon: Repeat2,
      count: event.repostsCount || 0,
      active: !!event.userReposted,
      accent: 'text-status-positive',
      onClick: onRepostClick,
      disabled: isReposting,
    },
    {
      key: 'like',
      label: 'Like',
      icon: Heart,
      count: event.likesCount || 0,
      active: !!event.userLiked,
      accent: 'text-status-negative',
      onClick: handleLike,
      disabled: isLiking,
    },
    {
      key: 'dislike',
      label: 'Dislike',
      icon: ThumbsDown,
      count: event.dislikesCount || 0,
      active: !!event.userDisliked,
      accent: 'text-status-warning',
      onClick: handleDislike,
      disabled: isDisliking,
      title: 'Dislike this post — helps the crowd flag scams',
    },
    {
      key: 'share',
      label: 'Share',
      icon: Share2,
      active: !!event.userShared,
      accent: 'text-fg-primary',
      onClick: handleShareOpen,
      disabled: isSharing,
      fillWhenActive: false,
    },
  ];

  return (
    <>
      {/* `-ml-1.5` pulls the first icon's round target back so the ICON aligns
          with the text above it, not the padding around it. Applied once, to
          the row, instead of to one button and not the others. */}
      <div className="-ml-1.5 mt-2 flex max-w-[425px] items-center justify-between">
        {actions.map(spec => (
          <ActionButton key={spec.key} spec={spec} />
        ))}
      </div>

      <ShareModal
        isOpen={shareOpen}
        onClose={handleShareClose}
        onShare={handleShareConfirm}
        defaultText=""
        isSubmitting={isSharing}
      />
    </>
  );
}
