'use client';

import React from 'react';
import { TimelineDisplayEvent } from '@/types/timeline';
import { useAuth } from '@/hooks/useAuth';
import { PostHeader } from './PostHeader';
import { PostContent } from './PostContent';
import { PostActions } from './PostActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { RepostModal } from './RepostModal';
import { ThreadIndicator } from './ThreadContext';
import { EditPostModal } from './EditPostModal';
import { DeletePostDialog } from './DeletePostDialog';
import AvatarLink from '@/components/ui/AvatarLink';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { usePostCardActions } from './usePostCardActions';
import ReplyAiButton from './ReplyAiButton';
import PostAiEditMenu from './PostAiEditMenu';
import { TIMELINE_SURFACE, TIMELINE_AVATAR_SIZE } from '@/config/timeline';

interface PostCardProps {
  event: TimelineDisplayEvent;
  onUpdate: (updates: Partial<TimelineDisplayEvent>) => void;
  /** A post created from this card (a quote repost), for the list to show. */
  onAddEvent?: (event: TimelineDisplayEvent) => void;
  onDelete?: () => void;
  compact?: boolean;
  showMetrics?: boolean;
  onReplyCreated?: (reply: TimelineDisplayEvent) => void;
  showThreading?: boolean;
  onShowThread?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (eventId: string) => void;
}

export function PostCard({
  event,
  onUpdate,
  onAddEvent,
  onDelete,
  compact = false,
  showMetrics: _showMetrics = true,
  onReplyCreated,
  showThreading = true,
  onShowThread,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: PostCardProps) {
  const { user, profile } = useAuth();

  const {
    canEdit,
    showReplyInput,
    replyText,
    setReplyText,
    isReplying,
    showMenu,
    showEditModal,
    setShowEditModal,
    showDeleteDialog,
    setShowDeleteDialog,
    isEditing,
    isDeleting,
    isReposting,
    repostModalOpen,
    handleMenuToggle,
    handleEditClick,
    handleEditSave,
    handleDeleteClick,
    handleDeleteConfirm,
    handleToggleReply,
    handleReplySubmit,
    handleSelectionClick,
    handlePostClick,
    handleRepostClick,
    handleRepostClose,
    handleSimpleRepost,
    handleQuoteRepost,
  } = usePostCardActions({
    event,
    user,
    profile,
    onUpdate,
    onAddEvent,
    onDelete,
    onReplyCreated,
    isSelectionMode,
    onToggleSelect,
  });

  const isRepost = event.metadata?.is_repost;
  const isQuoteRepost = event.metadata?.is_quote_repost;
  const isSimpleRepost = isRepost && !isQuoteRepost;

  return (
    <>
      <article
        onClick={handlePostClick}
        className={cn(
          TIMELINE_SURFACE.post,
          'cursor-pointer',
          compact && 'py-2',
          isSelectionMode && 'pl-2',
          isSelected && TIMELINE_SURFACE.selectedPost
        )}
        data-event-id={event.id}
      >
        {isSimpleRepost && (
          <div
            className={cn(
              'flex items-center gap-2 text-fg-secondary text-xs mb-1',
              isSelectionMode ? 'ml-14' : 'ml-12'
            )}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
            </svg>
            <span>{event.actor?.name} reposted</span>
          </div>
        )}

        <div className="flex gap-3">
          {isSelectionMode && (
            <div className="flex-shrink-0 flex items-start pt-2">
              <button
                onClick={handleSelectionClick}
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors',
                  isSelected
                    ? 'border-fg-primary bg-fg-primary text-fg-inverted'
                    : 'border-strong bg-surface-page hover:border-fg-primary'
                )}
                aria-label={isSelected ? 'Deselect post' : 'Select post'}
                aria-checked={isSelected}
                role="checkbox"
              >
                {isSelected && <Check className="w-4 h-4" strokeWidth={3} />}
              </button>
            </div>
          )}

          <div className="flex-shrink-0">
            <AvatarLink
              username={
                isSimpleRepost ? event.metadata?.original_actor_username : event.actor.username
              }
              userId={isSimpleRepost ? event.metadata?.original_actor_id : event.actor?.id}
              avatarUrl={
                isSimpleRepost ? event.metadata?.original_actor_avatar : event.actor?.avatar
              }
              name={isSimpleRepost ? event.metadata?.original_actor_name : event.actor?.name}
              size={TIMELINE_AVATAR_SIZE}
            />
          </div>

          <div className="flex-1 min-w-0">
            <PostHeader
              event={event}
              canEdit={canEdit}
              isSimpleRepost={isSimpleRepost}
              showMenu={showMenu}
              onMenuToggle={handleMenuToggle}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />

            <div className="mt-1">
              <PostContent event={event} />
            </div>

            <PostActions
              event={event}
              onUpdate={onUpdate}
              onToggleComments={handleToggleReply}
              onRepostClick={handleRepostClick}
              isReposting={isReposting}
            />

            {showThreading &&
              event.threadId &&
              (event.threadRepliesCount || event.replyCount || 0) > 0 && (
                <div className="mt-2">
                  <ThreadIndicator
                    threadId={event.threadId}
                    replyCount={event.threadRepliesCount || event.replyCount || 0}
                    onShowThread={onShowThread}
                  />
                </div>
              )}

            {showReplyInput && user && (
              <div className="mt-3 flex gap-3 pt-3 border-t border-subtle">
                <AvatarLink
                  username={profile?.username || null}
                  userId={user.id}
                  avatarUrl={profile?.avatar_url || null}
                  name={profile?.name || profile?.username || 'You'}
                  size={32}
                  className="flex-shrink-0"
                />
                <div className="flex-1">
                  <Textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Post your reply"
                    className="min-h-11 text-sm border-none bg-transparent p-0 focus:ring-0 resize-none placeholder:text-fg-secondary"
                    disabled={isReplying}
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ReplyAiButton
                        parentText={event.description || event.title || ''}
                        parentAuthor={event.actor?.username || event.actor?.name}
                        onDraft={setReplyText}
                        disabled={isReplying}
                      />
                      {replyText.trim() && (
                        <PostAiEditMenu
                          text={replyText}
                          onRevised={setReplyText}
                          disabled={isReplying}
                        />
                      )}
                    </div>
                    <Button
                      onClick={handleReplySubmit}
                      disabled={!replyText.trim() || isReplying}
                      size="sm"
                      className={TIMELINE_SURFACE.buttonPrimary}
                    >
                      {isReplying ? 'Replying...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <RepostModal
          isOpen={repostModalOpen}
          onClose={handleRepostClose}
          event={event}
          onSimpleRepost={handleSimpleRepost}
          onQuoteRepost={handleQuoteRepost}
          isReposting={isReposting}
          // Identity comes from the PROFILE, never from the auth session.
          //
          // This block used to read user_metadata and fall back to user.email.
          // user_metadata holds whatever the OAuth provider handed over at
          // signup — for a Google account that is the real name on the Google
          // profile, and an lh3.googleusercontent.com avatar URL that Google
          // rotates and which therefore 404s. The broken <img> then rendered
          // its own alt text, so the repost composer displayed
          // "<real name>'s avatar" in plain sight, and the email fallback was
          // one null profile away from displaying an email address as a
          // username. A pseudonymous account cannot be pseudonymous if the
          // session object is allowed to speak for it.
          //
          // profiles is the only identity the user actually controls, so it is
          // the only source. When it is missing the answer is a neutral
          // placeholder — never a different, truer name.
          currentUser={{
            id: user?.id,
            name: profile?.name || profile?.username || 'You',
            username: profile?.username || '',
            avatar: profile?.avatar_url || null,
          }}
        />
      </article>

      <EditPostModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        event={event}
        onSave={handleEditSave}
        isSaving={isEditing}
      />

      <DeletePostDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        postPreview={event.description || event.title}
      />
    </>
  );
}

export default PostCard;
