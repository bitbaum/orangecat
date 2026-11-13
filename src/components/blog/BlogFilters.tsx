'use client';

import { Filter } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { BlogPost } from '@/lib/blog';
import { sharedTopics, type TimeFilter, type TimeFilterOption } from './useBlogFilters';
import { cn } from '@/lib/utils';

interface BlogFiltersProps {
  posts: BlogPost[];
  tags: string[];
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedTimeFilter: TimeFilter;
  setSelectedTimeFilter: (filter: TimeFilter) => void;
  timeFilterOptions: TimeFilterOption[];
  filteredPosts: BlogPost[];
  clearFilters: () => void;
}

const TOPIC =
  'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors';
const TOPIC_ON = 'bg-fg-primary text-fg-inverted';
const TOPIC_OFF = 'bg-surface-raised text-fg-secondary hover:bg-surface-overlay';

/**
 * Two rows at every width, so the first post is on the first screen: the time
 * range as one SegmentedControl, and the topics two or more posts share as one
 * line that scrolls sideways. It used to be a wall of ~70 wrapping pills (one
 * per tag and one per month) above the posts on a desk.
 */
export function BlogFilters({
  posts,
  tags,
  selectedTag,
  setSelectedTag,
  selectedTimeFilter,
  setSelectedTimeFilter,
  timeFilterOptions,
  filteredPosts,
  clearFilters,
}: BlogFiltersProps) {
  const topics = sharedTopics(posts, tags, selectedTag);
  const active = Boolean(selectedTag) || selectedTimeFilter !== 'all';

  return (
    <div className="mb-8 space-y-4">
      {timeFilterOptions.length > 1 && (
        <SegmentedControl
          label="Posts from"
          items={timeFilterOptions.map(option => ({ value: option.key, label: option.label }))}
          value={selectedTimeFilter}
          onChange={setSelectedTimeFilter}
          className="max-w-xl"
        />
      )}

      {topics.length > 0 && (
        <div
          role="group"
          aria-label="Topics"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        >
          <button
            type="button"
            aria-pressed={!selectedTag}
            onClick={() => setSelectedTag(null)}
            className={cn(TOPIC, !selectedTag ? TOPIC_ON : TOPIC_OFF)}
          >
            All topics
          </button>
          {topics.map(tag => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={cn(TOPIC, selectedTag === tag ? TOPIC_ON : TOPIC_OFF)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-raised p-4 text-sm">
          <Filter className="h-4 w-4 text-fg-secondary" aria-hidden />
          <span className="text-fg-secondary">
            {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
            {selectedTag ? ` on ${selectedTag}` : ''}
            {selectedTimeFilter !== 'all'
              ? `, ${timeFilterOptions.find(opt => opt.key === selectedTimeFilter)?.label.toLowerCase() ?? ''}`
              : ''}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex min-h-11 items-center text-sm text-fg-primary underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
