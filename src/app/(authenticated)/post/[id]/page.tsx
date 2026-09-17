'use client';

import React, { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PostCard } from '@/components/timeline/PostCard';
import TimelineComposer from '@/components/timeline/TimelineComposer';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/config/routes';
import { TimelineDisplayEvent } from '@/types/timeline';
import { usePostThread } from './usePostThread';
import { useAwaitCatReply } from '@/hooks/useAwaitCatReply';
import CatIsAnswering from '@/components/timeline/CatIsAnswering';

/**
 * Thread View Page - X-style conversation thread
 *
 * Shows a single post with its full context:
 * - Parent posts (if this is a reply)
 * - The main post
 * - All replies/comments
 */
export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const postId = params?.id as string;

  const {
    mainPost,
    parentPosts,
    replies,
    isLoading,
    error,
    handlePostUpdate,
    handleReplyCreated,
    handleNestedReplyCreated,
    handleReplyDeleted,
  } = usePostThread(postId);

  // Tagging the Cat should behave like tagging @grok: you ask in the thread and
  // the answer turns up in the thread. It already replied in the right place —
  // it just never arrived, because the thread refetches once when your reply is
  // created and the Cat takes 10–17s to think. So the reply sat in the database
  // until someone reloaded.
  const { awaitingParentId, watchIfTagged } = useAwaitCatReply({
    onArrived: handleNestedReplyCreated,
  });

  const handleReplyPosted = useCallback(
    (created?: TimelineDisplayEvent) => {
      handleReplyCreated();
      watchIfTagged(created);
    },
    [handleReplyCreated, watchIfTagged]
  );

  const pageHeader = (
    <header className="sticky top-0 z-10 bg-surface-base backdrop-blur-sm border-b border-default">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Post</h1>
      </div>
    </header>
  );

  const renderReplies = useCallback(
    (items: TimelineDisplayEvent[], depth: number = 0): React.ReactNode => {
      return items.map(reply => (
        <div
          key={reply.id}
          className={cn(
            depth === 0 ? 'border-b border-default' : 'border-l border-subtle',
            depth > 0 ? 'pl-4 ml-4' : ''
          )}
        >
          <PostCard
            event={reply}
            onUpdate={updates => handlePostUpdate(reply.id, updates)}
            onReplyCreated={newReply => handleNestedReplyCreated(reply.id, newReply)}
            onDelete={() => handleReplyDeleted(reply.id)}
          />
          {reply.replies && reply.replies.length > 0 && renderReplies(reply.replies, depth + 1)}
        </div>
      ));
    },
    [handleNestedReplyCreated, handlePostUpdate, handleReplyDeleted]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-page">
        {pageHeader}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-fg-tertiary" />
        </div>
      </div>
    );
  }

  if (error || !mainPost) {
    return (
      <div className="min-h-screen bg-surface-page">
        {pageHeader}
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <p className="text-xl font-bold text-fg-primary mb-2">This post doesn&apos;t exist</p>
          <p className="text-fg-secondary mb-4">
            It may have been deleted or the link is incorrect.
          </p>
          <Link href={ROUTES.TIMELINE}>
            <Button>Go to Timeline</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page">
      {pageHeader}

      <div className="max-w-2xl mx-auto">
        {/* Parent posts (conversation context) */}
        {parentPosts.length > 0 && (
          <div className="relative">
            {parentPosts.map((parent, _index) => (
              <div key={parent.id} className="relative">
                <div
                  className="absolute left-[34px] top-[52px] bottom-0 w-0.5 bg-border"
                  style={{ height: 'calc(100% - 52px + 12px)' }}
                />
                <PostCard
                  event={parent}
                  onUpdate={updates => handlePostUpdate(parent.id, updates)}
                  compact
                />
              </div>
            ))}
          </div>
        )}

        {/* Main post - expanded view */}
        <div className="border-b border-default">
          <PostCard
            event={mainPost}
            onUpdate={updates => handlePostUpdate(mainPost.id, updates)}
            // Without this the card's onDelete is undefined, so deleting the
            // post you are looking at left it on screen — deleted in the
            // database, still rendered, until you reloaded and got "This post
            // doesn't exist". `replace` rather than `push` because Back must
            // not return to a page that no longer has anything to show.
            onDelete={() => router.replace(ROUTES.TIMELINE)}
            showMetrics={true}
          />

          {/* Engagement stats bar */}
          <div className="px-4 py-3 border-t border-subtle flex items-center gap-6 text-sm">
            {(mainPost.repostsCount || 0) > 0 && (
              <button className="hover:underline">
                <span className="font-bold text-fg-primary">{mainPost.repostsCount}</span>
                <span className="text-fg-secondary ml-1">Reposts</span>
              </button>
            )}
            {(mainPost.likesCount || 0) > 0 && (
              <button className="hover:underline">
                <span className="font-bold text-fg-primary">{mainPost.likesCount}</span>
                <span className="text-fg-secondary ml-1">Likes</span>
              </button>
            )}
            {(mainPost.commentsCount || 0) > 0 && (
              <button className="hover:underline">
                <span className="font-bold text-fg-primary">{mainPost.commentsCount}</span>
                <span className="text-fg-secondary ml-1">
                  {mainPost.commentsCount === 1 ? 'Reply' : 'Replies'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Reply composer */}
        {user && (
          <div className="border-b border-default">
            <TimelineComposer
              placeholder={`Reply to @${mainPost.actor.username || mainPost.actor.name}`}
              buttonText="Reply"
              showBanner={false}
              onPostCreated={handleReplyPosted}
              parentEventId={mainPost.id}
              parentPostText={mainPost.description || mainPost.title}
              parentAuthorName={mainPost.actor.username || mainPost.actor.name}
            />
          </div>
        )}

        {/* Replies section */}
        {replies.length > 0 && (
          <div>
            <div className="px-4 py-3 border-b border-default">
              <h2 className="font-bold text-fg-primary">Replies</h2>
            </div>
            {renderReplies(replies)}
          </div>
        )}

        {/* Shown from the moment a reply tags the Cat until its answer lands,
            so the 10–17s it spends thinking reads as a wait rather than as
            nothing having happened. */}
        {awaitingParentId && <CatIsAnswering />}

        {replies.length === 0 && !awaitingParentId && (
          <div className="py-12 text-center">
            <p className="text-fg-secondary">No replies yet</p>
            {user && <p className="text-sm text-fg-tertiary mt-1">Be the first to reply!</p>}
          </div>
        )}
      </div>
    </div>
  );
}
