'use client';

import React, { useEffect } from 'react';
import TimelineComponent from './TimelineComponent';
import TimelineComposer from './TimelineComposer';
import Button from '@/components/ui/Button';
import { useTimelineView } from './useTimelineView';
import type { TimelineDisplayEvent } from '@/types/timeline';
import { TIMELINE_COPY, TIMELINE_SURFACE } from '@/config/timeline';

export interface TimelineViewProps {
  feedType: 'journey' | 'community' | 'profile' | 'project';
  ownerId?: string;
  ownerType?: 'profile' | 'project';
  showComposer?: boolean;
  compact?: boolean;
  showFilters?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  onPostCreated?: () => void;
  onOptimisticEvent?: (event: TimelineDisplayEvent) => void;
}

export default function TimelineView({
  feedType,
  ownerId,
  ownerType = 'profile',
  showComposer = false,
  compact = false,
  showFilters = false,
  emptyStateTitle,
  emptyStateDescription,
  onPostCreated,
  onOptimisticEvent,
}: TimelineViewProps) {
  const {
    user,
    authLoading,
    hydrated,
    feed,
    loading,
    error,
    mergedFeed,
    loadFeed,
    handleEventUpdate,
    handleLoadMore,
    handlePostCreated,
    handleOptimisticEvent,
  } = useTimelineView({ feedType, ownerId, onPostCreated, onOptimisticEvent });

  if (hydrated && !authLoading && !user && (feedType === 'journey' || feedType === 'community')) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-semibold text-fg-primary mb-4">Please sign in</h2>
        <p className="text-fg-secondary mb-6">You need to be signed in to view this timeline.</p>
        <Button onClick={() => (window.location.href = '/auth')}>Sign In</Button>
      </div>
    );
  }

  if (!hydrated || authLoading || loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-md border border-subtle bg-surface-page p-4"
          >
            <div className="flex items-start space-x-3">
              <div className="h-12 w-12 rounded-md bg-surface-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-raised rounded w-1/4" />
                <div className="h-4 bg-surface-raised rounded w-3/4" />
                <div className="h-4 bg-surface-raised rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-status-negative text-lg mb-4">{error}</p>
        <Button variant="outline" onClick={() => loadFeed()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (feed && feed.events.length === 0) {
    const defaultTitle =
      feedType === 'journey'
        ? 'No posts yet'
        : feedType === 'community'
          ? 'No community posts yet'
          : 'No posts on this timeline yet';

    const defaultDescription =
      feedType === 'journey'
        ? "Share your first update about what you're working on!"
        : feedType === 'community'
          ? 'Be the first to share something with the community!'
          : 'Be the first to post on this timeline!';

    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-semibold text-fg-primary mb-2">
          {emptyStateTitle || defaultTitle}
        </h3>
        <p className="text-fg-secondary max-w-md mx-auto">
          {emptyStateDescription || defaultDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mergedFeed && <FocusScroller />}
      {showComposer &&
        (user ? (
          <TimelineComposer
            targetOwnerId={ownerId}
            targetOwnerType={ownerType}
            allowProjectSelection={feedType === 'profile' || feedType === 'project'}
            onPostCreated={handlePostCreated}
            placeholder={
              feedType === 'profile'
                ? 'Write on this timeline...'
                : feedType === 'project'
                  ? 'Share an update about this project...'
                  : TIMELINE_COPY.composePlaceholder
            }
            buttonText={TIMELINE_COPY.postButton}
            showBanner={Boolean(ownerId && ownerId !== user.id)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-subtle bg-surface-page px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-fg-primary">Sign in to post</p>
                <p className="text-sm text-fg-secondary">
                  You need to be signed in to write on this timeline.
                </p>
              </div>
              <Button
                onClick={() => {
                  const redirect =
                    typeof window !== 'undefined'
                      ? window.location.pathname + window.location.search
                      : '/profiles/me';
                  // `from` is the param /auth reads (useAuthForm.ts). This said `redirect`,
                  // which nothing reads, so signing in from here always landed on
                  // /dashboard instead of coming back.
                  window.location.href = `/auth?from=${encodeURIComponent(redirect)}`;
                }}
                className={TIMELINE_SURFACE.buttonPrimary}
              >
                Sign in
              </Button>
            </div>
          </div>
        ))}

      {mergedFeed && (
        <TimelineComponent
          feed={mergedFeed}
          onEventUpdate={handleEventUpdate}
          // A quote repost made from a card lands in the same optimistic list
          // the composer already uses, so it appears where it was made instead
          // of only after a reload.
          onEventCreated={handleOptimisticEvent}
          onLoadMore={handleLoadMore}
          showFilters={showFilters}
          compact={compact}
        />
      )}
    </div>
  );
}

function FocusScroller() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const focusId = params.get('focus');
      if (focusId) {
        const el = document.querySelector(`[data-event-id="${focusId}"]`);
        if (el) {
          (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          (el as HTMLElement).classList.add('ring-2', 'ring-fg-primary', 'ring-offset-2');
          setTimeout(() => {
            (el as HTMLElement).classList.remove('ring-2', 'ring-fg-primary', 'ring-offset-2');
          }, 1800);
        }
      }
    } catch {}
  }, []);
  return null;
}
