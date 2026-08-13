'use client';

import React, { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { TimelineDisplayEvent } from '@/types/timeline';
import AvatarLink from '@/components/ui/AvatarLink';
import Link from 'next/link';
import { formatRelativeTime } from '@/utils/dates';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TIMELINE_CONTENT_LIMITS, TIMELINE_SURFACE } from '@/config/timeline';
import { optionalPublicProfilePath } from '@/config/public-profile-path';

const QUOTE_MAX_LENGTH = TIMELINE_CONTENT_LIMITS.quote;

// Type for repost metadata
interface RepostMetadata {
  original_actor_name?: string;
  original_actor_username?: string;
  original_actor_id?: string;
  original_actor_avatar?: string;
  original_description?: string;
  [key: string]: unknown;
}

interface RepostModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: TimelineDisplayEvent;
  onSimpleRepost: () => Promise<void>;
  onQuoteRepost: (quoteText: string) => Promise<void>;
  isReposting?: boolean;
  currentUser?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
    avatar?: string | null;
  };
}

export function RepostModal({
  isOpen,
  onClose,
  event,
  onSimpleRepost,
  onQuoteRepost,
  isReposting = false,
  currentUser,
}: RepostModalProps) {
  const [quoteText, setQuoteText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const cleanText = (text?: string | null) =>
    (text || '')
      .replace(/^Reposted from .*?:\s*/i, '')
      .replace(/^Quote repost from .*?:\s*/i, '')
      .trim();

  // Prefer original author info when available
  const metadata = event.metadata as RepostMetadata | undefined;
  const originalAuthor = {
    name: metadata?.original_actor_name || event.actor.name || 'User',
    username: metadata?.original_actor_username || event.actor.username || '',
    id: metadata?.original_actor_id || event.actor.id,
    avatar: metadata?.original_actor_avatar || event.actor.avatar || null,
  };
  const originalAuthorHref = optionalPublicProfilePath(originalAuthor.username);

  // Extract original body, stripping legacy separators
  const originalBody = (() => {
    if (metadata?.original_description) {
      return cleanText(metadata.original_description);
    }
    if (event.description?.includes('\n\n---\n\n')) {
      const [maybeQuote, maybeOriginal] = event.description.split('\n\n---\n\n');
      return cleanText(maybeOriginal) || cleanText(maybeQuote);
    }
    return cleanText(event.description);
  })();

  const handleSimpleRepost = async () => {
    if (isReposting) {
      return;
    }
    await onSimpleRepost();
    onClose();
  };

  const handleQuoteRepost = async () => {
    if (isReposting) {
      return;
    }
    if (quoteText.trim()) {
      await onQuoteRepost(quoteText.trim());
      setQuoteText('');
      // keep quote mode open for next use; modal will close
      onClose();
    }
  };

  // Focus textarea when opened - hook must be called unconditionally
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Global keyboard handling: Ctrl/Cmd+Enter to submit (Escape is handled by Dialog)
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (quoteText.trim()) {
          handleQuoteRepost();
        } else {
          handleSimpleRepost();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, quoteText]);

  // Compute these unconditionally (hooks-safe: values are derived from props/state, not hooks)
  const timeAgo = formatRelativeTime(event.eventTimestamp);
  const remainingCharacters = QUOTE_MAX_LENGTH - quoteText.length;
  const currentActor = {
    id: currentUser?.id || 'me',
    name: currentUser?.name || 'You',
    username: currentUser?.username || '',
    avatar: currentUser?.avatar || null,
  };
  const canQuote = quoteText.trim().length > 0 && remainingCharacters >= 0 && !isReposting;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl p-0">
        <DialogTitle className="sr-only">Repost</DialogTitle>
        <div className="w-full rounded-md border border-subtle bg-surface-page">
          {/* Header */}
          <div className="flex items-center border-b border-subtle px-4 py-3">
            <div className="text-sm font-semibold text-fg-primary">Repost</div>
          </div>

          {/* Quote-first layout like X */}
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              <AvatarLink
                username={currentActor.username || null}
                userId={currentActor.id}
                avatarUrl={currentActor.avatar}
                name={currentActor.name}
                size={40}
                className="flex-shrink-0"
              />
              <textarea
                id="quote-text"
                ref={textareaRef}
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleQuoteRepost();
                  }
                }}
                rows={4}
                className="w-full resize-none rounded-md border border-subtle bg-surface-page px-4 py-3 text-base text-fg-primary placeholder:text-fg-secondary focus:border-interactive focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Add a comment"
                maxLength={QUOTE_MAX_LENGTH}
                aria-label="Add your comment before reposting"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between text-sm px-1">
              <div className="flex items-center gap-2 text-fg-secondary">
                <span
                  className={
                    remainingCharacters <= 20
                      ? 'text-status-warning font-semibold'
                      : 'text-fg-secondary'
                  }
                >
                  {remainingCharacters}
                </span>
                <span className="text-fg-tertiary">characters left</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleSimpleRepost}
                  disabled={isReposting}
                  className="h-9 px-3 text-sm"
                >
                  Repost
                </Button>
                <Button
                  onClick={handleQuoteRepost}
                  disabled={!canQuote}
                  isLoading={isReposting}
                  className={TIMELINE_SURFACE.buttonPrimary}
                >
                  Quote post
                </Button>
              </div>
            </div>

            {/* Original Post Preview (X-style) */}
            <div className="rounded-md border border-subtle bg-surface-raised p-3 transition-colors hover:bg-surface-raised/80">
              <div className="flex items-start gap-3">
                <AvatarLink
                  username={originalAuthor.username || null}
                  userId={originalAuthor.id}
                  avatarUrl={originalAuthor.avatar}
                  name={originalAuthor.name}
                  size={36}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {originalAuthorHref ? (
                      <Link
                        href={originalAuthorHref}
                        className="font-semibold text-sm text-fg-primary hover:underline"
                      >
                        {originalAuthor.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-sm text-fg-primary">
                        {originalAuthor.name}
                      </span>
                    )}
                    {originalAuthor.username && (
                      <>
                        <span className="text-fg-secondary text-sm">
                          @{originalAuthor.username}
                        </span>
                        <span className="text-fg-tertiary text-sm">·</span>
                      </>
                    )}
                    <span className="text-fg-secondary text-sm">{timeAgo}</span>
                  </div>
                  {originalBody && (
                    <p className="text-sm text-fg-primary whitespace-pre-wrap break-words leading-relaxed">
                      {originalBody}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
