'use client';

import React, { useRef } from 'react';
import { LucideIcon, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import TimelineLayout from './TimelineLayout';
import { TimelineFeedResponse } from '@/types/timeline';
import TimelineComposer from './TimelineComposer';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useSocialTimeline } from './useSocialTimeline';
import { TimelineSortingControls } from './TimelineSortingControls';
import { TimelineSearchControls } from './TimelineSearchControls';
import { TIMELINE_COPY, TIMELINE_SURFACE } from '@/config/timeline';

export interface SocialTimelineProps {
  title: string;
  icon: LucideIcon;
  mode: 'timeline' | 'community' | 'following';
  timelineOwnerId?: string;
  timelineOwnerType?: 'profile' | 'project';
  timelineOwnerName?: string;
  showShareButton?: boolean;
  shareButtonText?: string;
  shareButtonIcon?: LucideIcon;
  defaultSort?: 'recent' | 'trending' | 'popular';
  showSortingControls?: boolean;
  customStats?: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalFollowers?: number;
  };
  showInlineComposer?: boolean;
  allowProjectSelection?: boolean;
  onOptimisticUpdate?: (event: import('@/types/timeline').TimelineDisplayEvent) => void;
}

export default function SocialTimeline({
  title,
  icon: Icon,
  mode,
  timelineOwnerId,
  timelineOwnerType = 'profile',
  timelineOwnerName,
  showShareButton = false,
  shareButtonText = TIMELINE_COPY.shareUpdateButton,
  shareButtonIcon: ShareIcon = Plus,
  defaultSort = 'trending',
  showSortingControls = false,
  customStats,
  showInlineComposer = false,
  allowProjectSelection = false,
  onOptimisticUpdate,
}: SocialTimelineProps) {
  const composerRef = useRef<HTMLDivElement | null>(null);

  const {
    user,
    hydrated,
    authCheckComplete,
    isLoading,
    mergedFeed,
    timelineFeed,
    loading,
    isLoadingMore,
    error,
    sortBy,
    searchQuery,
    searchResults,
    searchTotal,
    searchError,
    searching,
    isSearchActive,
    setSearchQuery,
    loadTimelineFeed,
    handleSortChange,
    handleEventUpdate,
    handleLoadMore,
    handleSearch,
    handleClearSearch,
    handleOptimisticUpdate,
    invalidateTimelineCache,
  } = useSocialTimeline({ mode, defaultSort, onOptimisticUpdate });

  if (hydrated && authCheckComplete && !isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-fg-primary mb-4">Please sign in</h2>
          <p className="text-fg-secondary mb-6">You need to be signed in to view this page.</p>
          <Button onClick={() => (window.location.href = '/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (!authCheckComplete) {
    return (
      <div className="min-h-screen bg-surface-page p-4">
        <TimelineSkeleton count={5} />
      </div>
    );
  }

  const isInitialLoad = !hydrated || isLoading;

  const searchControls = (
    <TimelineSearchControls
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onSearch={handleSearch}
      onClearSearch={handleClearSearch}
      isSearchActive={isSearchActive}
      searching={searching}
      searchError={searchError}
      searchResultsCount={searchResults?.length || 0}
      searchTotal={searchTotal}
    />
  );

  const inlineComposer =
    showInlineComposer && user ? (
      <div ref={composerRef}>
        {searchControls}
        <TimelineComposer
          targetOwnerId={timelineOwnerId || (mode === 'timeline' ? user.id : undefined)}
          targetOwnerType={timelineOwnerType}
          targetOwnerName={timelineOwnerName}
          allowProjectSelection={allowProjectSelection}
          placeholder={
            mode === 'timeline'
              ? TIMELINE_COPY.composePlaceholder
              : TIMELINE_COPY.communityPlaceholder
          }
          buttonText={
            mode === 'timeline' ? TIMELINE_COPY.shareUpdateButton : TIMELINE_COPY.postButton
          }
          onPostCreated={() => {
            loadTimelineFeed(sortBy);
            invalidateTimelineCache();
          }}
          onOptimisticUpdate={handleOptimisticUpdate}
          showBanner={Boolean(timelineOwnerId && timelineOwnerId !== user.id)}
        />
      </div>
    ) : undefined;

  const postComposer = inlineComposer === undefined ? searchControls : undefined;

  const timelineStats =
    customStats ||
    (timelineFeed
      ? {
          totalPosts: timelineFeed.events.length,
          totalLikes: timelineFeed.events.reduce((sum, e) => sum + (e.likesCount || 0), 0),
          totalComments: timelineFeed.events.reduce((sum, e) => sum + (e.commentsCount || 0), 0),
          totalFollowers:
            mode === 'timeline' ? timelineFeed.events.filter(e => e.isRecent).length : undefined,
        }
      : undefined);

  const timelineFeedContent = mergedFeed || {
    events: [],
    pagination: { page: 1, limit: 20, total: 0, hasNext: false, hasPrev: false },
    filters: {
      eventTypes: [],
      dateRange: 'all',
      visibility: ['public'],
      actors: [],
      subjects: [],
      tags: [],
      sortBy,
    },
    metadata: { totalEvents: 0, featuredEvents: 0, lastUpdated: new Date().toISOString() },
  };

  const activeFeed: TimelineFeedResponse = isSearchActive
    ? {
        events: searchResults || [],
        pagination: {
          page: 1,
          limit: searchResults?.length || 0,
          total: searchResults?.length || 0,
          hasNext: false,
          hasPrev: false,
        },
        filters: { ...timelineFeedContent.filters, search: searchQuery },
        metadata: {
          ...timelineFeedContent.metadata,
          totalEvents: searchResults?.length || 0,
          lastUpdated: new Date().toISOString(),
        },
      }
    : timelineFeedContent;

  const emptyState = isSearchActive ? (
    searching ? (
      <TimelineSkeleton count={3} />
    ) : searchError ? (
      <div className="text-center py-10">
        <Icon className="w-14 h-14 text-status-negative/60 mx-auto mb-3" />
        <p className="text-status-negative text-lg mb-2">{searchError}</p>
        <Button variant="outline" onClick={handleClearSearch}>
          Clear Search
        </Button>
      </div>
    ) : activeFeed.events.length === 0 ? (
      <div className="text-center py-10">
        <Icon className="w-14 h-14 text-fg-tertiary dark:text-fg-secondary mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-fg-primary mb-1">No posts found</h3>
        <p className="text-fg-secondary">Try another search term.</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={handleClearSearch}>
            Clear search
          </Button>
        </div>
      </div>
    ) : null
  ) : isInitialLoad || loading ? (
    <TimelineSkeleton count={5} />
  ) : error ? (
    <div className="text-center py-16">
      <Icon className="w-16 h-16 text-status-negative/60 mx-auto mb-4" />
      <p className="text-status-negative text-lg mb-4">{error}</p>
      <Button variant="outline" onClick={() => loadTimelineFeed(sortBy)}>
        Try Again
      </Button>
    </div>
  ) : timelineFeed?.events.length === 0 ? (
    <div className="text-center py-16">
      <Icon className="w-20 h-20 text-fg-tertiary dark:text-fg-secondary mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-fg-primary mb-2">No posts yet</h3>
      <p className="text-fg-secondary max-w-md mx-auto">
        {mode === 'timeline'
          ? "Share your first update about what you're working on!"
          : 'Be the first to share something productive with the community!'}
      </p>
    </div>
  ) : null;

  const headerContent =
    showSortingControls || (showShareButton && user) ? (
      <>
        {showSortingControls && (
          <TimelineSortingControls sortBy={sortBy} onSortChange={handleSortChange} />
        )}
        {showShareButton && user && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (composerRef.current) {
                const element = composerRef.current;
                const elementPosition = element.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top: elementPosition - 80, behavior: 'smooth' });
              }
            }}
            className={TIMELINE_SURFACE.chip}
          >
            <ShareIcon className="w-4 h-4" />
            {shareButtonText}
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <TimelineLayout
      title={title}
      feed={activeFeed}
      onEventUpdate={handleEventUpdate}
      onLoadMore={handleLoadMore}
      isLoadingMore={isLoadingMore}
      stats={timelineStats}
      showFilters={false}
      compact={false}
      enableMultiSelect={mode === 'timeline'}
      additionalHeaderContent={headerContent}
      emptyState={emptyState}
      inlineComposer={inlineComposer}
      postComposer={postComposer}
    />
  );
}
