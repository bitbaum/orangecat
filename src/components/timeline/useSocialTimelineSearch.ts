'use client';

import { useState, useCallback } from 'react';
import { TimelineDisplayEvent } from '@/types/timeline';
import { timelineService } from '@/services/timeline';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export function useSocialTimelineSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TimelineDisplayEvent[] | null>(null);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const isSearchActive = searchResults !== null;

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const query = searchQuery.trim();
      if (query.length < 2) {
        setSearchError('Enter at least 2 characters');
        setSearchResults(null);
        setSearchTotal(null);
        return;
      }
      setSearching(true);
      setSearchError(null);
      const result = await timelineService.searchPosts(query, { limit: 30, offset: 0 });
      if (!result.success) {
        setSearchError(apiErrorMessage(result, 'Search failed. Please try again.'));
        setSearchResults(null);
        setSearchTotal(null);
      } else {
        setSearchResults(result.posts || []);
        setSearchTotal(result.total ?? result.posts?.length ?? 0);
      }
      setSearching(false);
    },
    [searchQuery]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchTotal(null);
    setSearchError(null);
  }, []);

  return {
    searchQuery,
    searchResults,
    searchTotal,
    searchError,
    searching,
    isSearchActive,
    setSearchQuery,
    handleSearch,
    handleClearSearch,
  };
}
