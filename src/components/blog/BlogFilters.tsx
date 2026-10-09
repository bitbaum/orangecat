'use client';

import { useState } from 'react';
import { Calendar, Tag, Filter, SlidersHorizontal, X } from 'lucide-react';
import { BlogPost } from '@/lib/blog';

interface TimeFilterOption {
  key: string;
  label: string;
  count: number;
}

interface BlogFiltersProps {
  tags: string[];
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedTimeFilter: string;
  setSelectedTimeFilter: (filter: string) => void;
  timeFilterOptions: TimeFilterOption[];
  filteredPosts: BlogPost[];
  clearFilters: () => void;
}

export function BlogFilters({
  tags,
  selectedTag,
  setSelectedTag,
  selectedTimeFilter,
  setSelectedTimeFilter,
  timeFilterOptions,
  filteredPosts,
  clearFilters,
}: BlogFiltersProps) {
  // On a phone the full chip cloud (fifty topics, nine periods) pushed the
  // first post two screens down — the reader opened "Blog" and saw no blog.
  // Below md the filters sit behind one button and open on request; from md
  // up they are always shown, where there is room beside the posts.
  const [open, setOpen] = useState(false);
  const active = Boolean(selectedTag) || selectedTimeFilter !== 'all';

  return (
    <div className="mb-8 space-y-6">
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-default px-4 text-sm font-medium text-fg-secondary transition-colors hover:text-fg-primary"
        >
          {open ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          {open ? 'Hide filters' : active ? 'Filters (on)' : 'Filter posts'}
        </button>
      </div>

      <div className={open ? 'space-y-6' : 'hidden space-y-6 md:block'}>
        {tags.length > 0 && (
          <div>
            <div className="flex items-center mb-4">
              <Tag className="w-4 h-4 mr-2 text-fg-secondary" />
              <h3 className="text-lg font-semibold">Filter by Topic</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !selectedTag
                    ? 'bg-fg-primary text-fg-inverted'
                    : 'bg-surface-raised text-fg-secondary hover:bg-surface-overlay'
                }`}
              >
                All Topics
              </button>
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTag === tag
                      ? 'bg-fg-primary text-fg-inverted'
                      : 'bg-surface-raised text-fg-secondary hover:bg-surface-overlay'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center mb-4">
            <Calendar className="w-4 h-4 mr-2 text-fg-secondary" />
            <h3 className="text-lg font-semibold">Filter by Time</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {timeFilterOptions.map(option => (
              <button
                key={option.key}
                onClick={() => setSelectedTimeFilter(option.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedTimeFilter === option.key
                    ? 'bg-fg-primary text-fg-inverted'
                    : 'bg-surface-raised text-fg-secondary hover:bg-surface-overlay'
                }`}
              >
                {option.label}
                <span className="ml-1.5 text-xs opacity-75">({option.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {(selectedTag || selectedTimeFilter !== 'all') && (
        <div className="flex items-center gap-4 p-4 bg-surface-raised rounded-lg">
          <Filter className="w-4 h-4 text-fg-secondary" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-fg-secondary">Showing:</span>
            {selectedTag && (
              <span className="px-2 py-1 bg-surface-raised text-fg-primary rounded text-xs font-medium">
                {selectedTag}
              </span>
            )}
            {selectedTimeFilter !== 'all' && (
              <span className="px-2 py-1 bg-surface-raised text-fg-primary rounded text-xs font-medium">
                {timeFilterOptions.find(opt => opt.key === selectedTimeFilter)?.label}
              </span>
            )}
            <span className="text-fg-secondary">•</span>
            <span className="text-fg-secondary font-medium">
              {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={clearFilters}
            className="ml-auto text-xs text-fg-secondary hover:text-fg-primary underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
