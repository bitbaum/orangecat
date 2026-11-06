'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { PostCard } from '@/components/timeline/PostCard';
import TimelineComposer from '@/components/timeline/TimelineComposer';
import { useAuth } from '@/hooks/useAuth';
import { usePostThread } from '@/hooks/usePostThread';
import { ROUTES } from '@/config/routes';
import type { TimelineDisplayEvent } from '@/types/timeline';

/**
 * The conversation under an article. An article is a timeline event, so its
 * replies are ordinary posts: the same cards, the same composer, the same
 * reply threads as everywhere else on the timeline — nothing new to learn.
 * Readers see the replies; signing in adds the box.
 */
export default function ArticleDiscussion({
  articleId,
  authorName,
}: {
  articleId: string;
  authorName: string;
}) {
  const { user } = useAuth();
  const {
    replies,
    isLoading,
    error,
    handlePostUpdate,
    handleReplyCreated,
    handleNestedReplyCreated,
    handleReplyDeleted,
  } = usePostThread(articleId);

  const renderReplies = useCallback(
    (items: TimelineDisplayEvent[], depth = 0): React.ReactNode =>
      items.map(reply => (
        <div
          key={reply.id}
          className={depth === 0 ? 'border-b border-subtle' : 'ml-4 border-l border-subtle pl-4'}
        >
          <PostCard
            event={reply}
            onUpdate={updates => handlePostUpdate(reply.id, updates)}
            onReplyCreated={newReply => handleNestedReplyCreated(reply.id, newReply)}
            onDelete={() => handleReplyDeleted(reply.id)}
            compact
          />
          {reply.replies && reply.replies.length > 0 && renderReplies(reply.replies, depth + 1)}
        </div>
      )),
    [handleNestedReplyCreated, handlePostUpdate, handleReplyDeleted]
  );

  const count = replies.length;

  return (
    <section aria-labelledby="discussion-heading" className="mt-12 border-t border-subtle pt-8">
      <h2 id="discussion-heading" className="text-xl font-semibold text-fg-primary">
        {isLoading
          ? 'Discussion'
          : count === 0
            ? 'No comments yet'
            : `${count} ${count === 1 ? 'comment' : 'comments'}`}
      </h2>
      {user ? (
        <div className="mt-4 rounded-md border border-subtle">
          <TimelineComposer
            placeholder={`Reply to ${authorName}`}
            buttonText="Comment"
            showBanner={false}
            onPostCreated={() => handleReplyCreated()}
            parentEventId={articleId}
            parentAuthorName={authorName}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-fg-secondary">
          <Link
            href={`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(`/articles`)}`}
            className="font-semibold text-fg-primary underline underline-offset-4"
          >
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-fg-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading comments…
        </div>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-status-negative">
          Comments could not be loaded. Reload the page to try again.
        </p>
      ) : (
        count > 0 && <div className="mt-6">{renderReplies(replies)}</div>
      )}
    </section>
  );
}
