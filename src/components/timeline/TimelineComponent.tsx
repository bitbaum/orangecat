'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TimelineDisplayEvent, TimelineFeedResponse, TimelineVisibility } from '@/types/timeline';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { PostCard } from './PostCard';
import { Button } from '@/components/ui/Button';
import { CheckSquare, Loader2, Newspaper } from 'lucide-react';
import { usePostSelection } from '@/hooks/usePostSelection';
import EmptyState from '@/components/ui/EmptyState';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { BulkDeleteConfirmDialog } from './BulkDeleteConfirmDialog';
import { TIMELINE_SURFACE } from '@/config/timeline';

interface TimelineComponentProps {
  feed: TimelineFeedResponse;
  onEventUpdate?: (eventId: string, updates: Partial<TimelineDisplayEvent>) => void;
  /**
   * A post created FROM a card — currently a quote repost. Without it the new
   * post is created and then dropped: usePostRepost only hands the result over
   * `if (result.event && onAddEvent)`, and nobody was passing one, so a repost
   * existed in the database and nowhere on screen until a reload.
   */
  onEventCreated?: (event: TimelineDisplayEvent) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  showFilters?: boolean;
  compact?: boolean;
  enableMultiSelect?: boolean;
}

export const TimelineComponent: React.FC<TimelineComponentProps> = ({
  feed,
  onEventUpdate,
  onEventCreated,
  onLoadMore,
  isLoadingMore = false,
  showFilters: _showFilters = true,
  compact = false,
  enableMultiSelect = false,
}) => {
  const [events, setEvents] = useState(feed.events);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const showSuccess = useCallback((message: string) => toast.success(message), []);
  const showError = useCallback((message: string) => toast.error(message), []);

  // Ref for the infinite scroll sentinel element
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync events when feed changes (e.g., from optimistic updates)
  useEffect(() => {
    setEvents(feed.events);
  }, [feed.events]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore || !feed.pagination.hasNext || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting && feed.pagination.hasNext && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: null, // viewport
        rootMargin: '100px', // trigger 100px before reaching sentinel
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, feed.pagination.hasNext, isLoadingMore]);

  // Use centralized selection hook (DRY)
  const {
    selectedIds: _selectedIds,
    isSelectionMode,
    isProcessing,
    toggleSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    bulkDelete,
    bulkSetVisibility,
    selectedCount,
    canPerformBulkAction: _canPerformBulkAction,
  } = usePostSelection({
    onPostsDeleted: deletedIds => {
      // Remove deleted events from local state
      setEvents(prev => prev.filter(e => !deletedIds.includes(e.id)));
      showSuccess(
        `Successfully deleted ${deletedIds.length} ${deletedIds.length === 1 ? 'post' : 'posts'}`
      );
    },
    onVisibilityChanged: (eventIds, newVisibility) => {
      // Update visibility in local state
      setEvents(prev =>
        prev.map(e => (eventIds.includes(e.id) ? { ...e, visibility: newVisibility } : e))
      );
      showSuccess(
        `Changed visibility of ${eventIds.length} ${eventIds.length === 1 ? 'post' : 'posts'} to ${newVisibility}`
      );
    },
  });

  // Handle individual event updates
  const handleEventUpdate = useCallback(
    (eventId: string, updates: Partial<TimelineDisplayEvent>) => {
      setEvents(prevEvents => {
        if (updates.isDeleted) {
          return prevEvents.filter(event => event.id !== eventId);
        }
        return prevEvents.map(event => (event.id === eventId ? { ...event, ...updates } : event));
      });
      onEventUpdate?.(eventId, updates);
    },
    [onEventUpdate]
  );

  // Handle individual post deletion
  const handlePostDelete = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    logger.info('Post deleted', { eventId }, 'TimelineComponent');
  }, []);

  // Filter out deleted events
  const visibleEvents = events.filter(event => !event.isDeleted);

  // Handle bulk delete with confirmation
  const handleBulkDeleteClick = useCallback(() => {
    setShowBulkDeleteConfirm(true);
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    setShowBulkDeleteConfirm(false);
    const result = await bulkDelete(visibleEvents);

    if (!result.success && result.failureCount > 0) {
      if (result.successCount === 0) {
        showError('Failed to delete posts. Please try again.');
      } else {
        showError(`Deleted ${result.successCount} posts, but ${result.failureCount} failed.`);
      }
    }
  }, [bulkDelete, visibleEvents, showError]);

  // Handle bulk visibility change
  const handleBulkVisibilityChange = useCallback(
    async (visibility: TimelineVisibility) => {
      const result = await bulkSetVisibility(visibleEvents, visibility);

      if (!result.success && result.failureCount > 0) {
        if (result.successCount === 0) {
          showError('Failed to change visibility. Please try again.');
        } else {
          showError(`Changed ${result.successCount} posts, but ${result.failureCount} failed.`);
        }
      }
    },
    [bulkSetVisibility, visibleEvents, showError]
  );

  if (visibleEvents.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No posts yet"
        description="Your timeline is empty. Create your first post to get started."
      />
    );
  }

  return (
    <div className="space-y-0">
      {/* Multi-Select Controls */}
      {enableMultiSelect && (
        <>
          {!isSelectionMode ? (
            /*
              The way IN to selection mode is not itself worth a banner.

              This used to be a full-width bar with its own border, background
              and `sticky top-16` — so a control for bulk-deleting old posts
              followed you down the entire feed, above every post you came to
              read. It was the fourth separate bordered band before the first
              post.

              Managing posts is a rare, deliberate task; reading them is the
              reason the page exists. So the entry point is a quiet inline
              control, and everything it opens — the full toolbar with counts,
              select-all and the destructive actions — is unchanged, because
              once you ARE selecting, that toolbar is the thing you need and
              it earns being sticky.
            */
            <div className="flex justify-end px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectionMode}
                className={TIMELINE_SURFACE.chip}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Select</span>
              </Button>
            </div>
          ) : (
            // Full bulk actions toolbar when in selection mode
            <BulkActionsToolbar
              selectedCount={selectedCount}
              totalCount={visibleEvents.length}
              isProcessing={isProcessing}
              onSelectAll={() => selectAll(visibleEvents)}
              onClearSelection={clearSelection}
              onExitSelectionMode={toggleSelectionMode}
              onBulkDelete={handleBulkDeleteClick}
              onBulkVisibilityChange={handleBulkVisibilityChange}
              className="top-16"
            />
          )}
        </>
      )}

      {/* Events List */}
      <div className="space-y-0">
        {visibleEvents.map(event => (
          <PostCard
            key={event.id}
            event={event}
            onUpdate={updates => handleEventUpdate(event.id, updates)}
            onAddEvent={onEventCreated}
            onDelete={() => handlePostDelete(event.id)}
            compact={compact}
            showMetrics={true}
            isSelectionMode={isSelectionMode}
            isSelected={isSelected(event.id)}
            onToggleSelect={toggleSelection}
          />
        ))}
      </div>

      {/* Infinite Scroll Sentinel & Loading Indicator */}
      {feed.pagination.hasNext && onLoadMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-fg-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading more posts...</span>
            </div>
          ) : (
            <div className="h-4" aria-hidden="true" />
          )}
        </div>
      )}

      {/* End of feed indicator */}
      {!feed.pagination.hasNext && events.length > 0 && (
        <div className="text-center py-6">
          <span className="text-sm text-fg-tertiary">You've reached the end</span>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <BulkDeleteConfirmDialog
          count={selectedCount}
          isProcessing={isProcessing}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={handleBulkDeleteConfirm}
        />
      )}
    </div>
  );
};

export default TimelineComponent;
