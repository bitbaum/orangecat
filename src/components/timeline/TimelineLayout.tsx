import React from 'react';
import { TimelineFeedResponse, TimelineDisplayEvent } from '@/types/timeline';
import TimelineComponent from './TimelineComponent';
import { cn } from '@/lib/utils';
import { TIMELINE_SURFACE } from '@/config/timeline';

export interface TimelineLayoutProps {
  title: string;
  feed: TimelineFeedResponse;
  onEventUpdate: (eventId: string, updates: Partial<TimelineDisplayEvent>) => void;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
  stats?: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalFollowers?: number;
  };
  showFilters?: boolean;
  compact?: boolean;
  enableMultiSelect?: boolean; // Enable multi-select mode for bulk operations
  additionalHeaderContent?: React.ReactNode;
  emptyState?: React.ReactNode;
  postComposer?: React.ReactNode;
  inlineComposer?: React.ReactNode;
}

/**
 * Reusable Timeline Layout Component
 *
 * DRY-compliant layout for timeline-based pages (Journey, Community, etc.)
 * Provides consistent styling, structure, and behavior across all timeline views.
 */
export default function TimelineLayout({
  title,
  feed,
  onEventUpdate,
  onLoadMore,
  isLoadingMore = false,
  stats: _stats,
  showFilters = false,
  compact = false,
  enableMultiSelect = false,
  additionalHeaderContent,
  emptyState,
  postComposer,
  inlineComposer,
}: TimelineLayoutProps) {
  return (
    <div className={TIMELINE_SURFACE.page}>
      <div className={TIMELINE_SURFACE.rail}>
        <div className={TIMELINE_SURFACE.feed}>
          {/*
            The header names the surface and gets out of the way.

            It used to carry a 36px icon tile, a 20px bold title AND a
            description line — roughly 100px of chrome above every feed, saying
            "Your personal timeline and story" to someone who just clicked
            "Timeline". The nav already answers where you are; a subtitle
            restating the title is a second source of truth for the same fact
            and pushes the first post below the fold.

            Now: the name, and whatever actions belong to this surface.
          */}
          <div className={cn(TIMELINE_SURFACE.header)}>
            <h1 className="text-lg font-semibold tracking-display text-fg-primary">{title}</h1>
            {additionalHeaderContent && (
              <div className="flex items-center gap-2">{additionalHeaderContent}</div>
            )}
          </div>

          {inlineComposer || postComposer}

          {emptyState ? (
            emptyState
          ) : (
            <TimelineComponent
              feed={feed}
              onEventUpdate={onEventUpdate}
              onLoadMore={onLoadMore}
              isLoadingMore={isLoadingMore}
              showFilters={showFilters}
              compact={compact}
              enableMultiSelect={enableMultiSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
