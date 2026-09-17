/**
 * TimelineSearchControls Component
 *
 * Post search for timeline feeds — collapsed to an icon until asked for.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { Search, Loader2, X } from 'lucide-react';
import { TIMELINE_SURFACE } from '@/config/timeline';

interface TimelineSearchControlsProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: (e?: React.FormEvent) => void;
  onClearSearch: () => void;
  isSearchActive: boolean;
  searching: boolean;
  searchError: string | null;
  searchResultsCount: number;
  searchTotal: number | null;
}

/**
 * Search is a thing you go and do, not a thing that sits on the page.
 *
 * This used to render a permanent full-width search field with its own border,
 * stacked above the composer. The timeline surface was five separate bordered
 * boxes before the first post — page header, search, composer, bulk-select,
 * then the feed — which is what "a bunch of random elements thrown together"
 * looks like. Every feed product shows one composer and then posts.
 *
 * Collapsed it is a single icon button; expanded it is the field it always
 * was. Nothing was removed, because nothing else in the app searches posts —
 * the global command palette covers pages and entities, not post text — so
 * deleting this would have taken away the only way to find a post.
 *
 * Stays open whenever a search is active, so results never appear with no
 * visible sign of what produced them.
 */
export function TimelineSearchControls({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onClearSearch,
  isSearchActive,
  searching,
  searchError,
  searchResultsCount,
  searchTotal,
}: TimelineSearchControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // An active search must never be invisible: if results are on screen, so is
  // the field that asked for them.
  const open = expanded || isSearchActive;

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
    }
  }, [expanded]);

  const close = () => {
    setExpanded(false);
    if (isSearchActive) {
      onClearSearch();
    }
  };

  if (!open) {
    return (
      <div className="flex justify-end px-4 py-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(true)}
          className={TIMELINE_SURFACE.chip}
          aria-label="Search posts"
          aria-expanded={false}
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-subtle bg-surface-page px-4 py-3">
      <form onSubmit={onSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-fg-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                close();
              }
            }}
            placeholder="Search posts"
            aria-label="Search posts"
            className="w-full rounded-md border border-subtle bg-surface-page py-2 pl-9 pr-3 text-sm text-fg-primary placeholder:text-fg-secondary focus:border-interactive focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <Button type="submit" size="sm" disabled={searching} className={TIMELINE_SURFACE.chip}>
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {searching ? 'Searching' : 'Search'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={close}
          className={TIMELINE_SURFACE.chip}
          aria-label={isSearchActive ? 'Clear search' : 'Close search'}
        >
          <X className="w-4 h-4" />
        </Button>
      </form>
      {searchError && <p className="text-sm text-status-negative mt-2">{searchError}</p>}
      {isSearchActive && !searchError && (
        <p className="text-xs text-fg-secondary mt-2">
          Showing {searchResultsCount} of {searchTotal ?? searchResultsCount} results
        </p>
      )}
    </div>
  );
}
