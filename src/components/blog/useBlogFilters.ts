'use client';

import { useMemo, useState } from 'react';
import { BlogPost } from '@/lib/blog';

export type TimeFilter = 'all' | 'thisyear' | 'last6months' | 'thismonth';

export interface TimeFilterOption {
  key: TimeFilter;
  label: string;
  count: number;
}

/**
 * Topics worth a filter: those two or more posts share. A topic with one post
 * is that post's own label, and seventy of them made a wall of pills above
 * the first post. The selected topic always stays, so it can be cleared.
 */
export function sharedTopics(
  posts: Pick<BlogPost, 'tags'>[],
  tags: string[],
  selected: string | null = null,
  min = 2
): string[] {
  const count = new Map<string, number>();
  for (const post of posts) {
    for (const tag of new Set(post.tags.map(t => t.toLowerCase()))) {
      count.set(tag, (count.get(tag) ?? 0) + 1);
    }
  }
  return tags.filter(
    tag =>
      (count.get(tag.toLowerCase()) ?? 0) >= min || tag.toLowerCase() === selected?.toLowerCase()
  );
}

export function useBlogFilters(posts: BlogPost[]) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('all');

  const timeFilterOptions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const postDates = posts.map(post => new Date(post.date));
    const years = Array.from(new Set(postDates.map(date => date.getFullYear()))).sort(
      (a, b) => b - a
    );
    const options: TimeFilterOption[] = [{ key: 'all', label: 'All time', count: posts.length }];

    if (years.includes(currentYear)) {
      const thisYearPosts = posts.filter(post => new Date(post.date).getFullYear() === currentYear);
      options.push({ key: 'thisyear', label: 'This year', count: thisYearPosts.length });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const last6MonthsPosts = posts.filter(post => new Date(post.date) >= sixMonthsAgo);
    if (last6MonthsPosts.length > 0 && last6MonthsPosts.length < posts.length) {
      options.push({ key: 'last6months', label: 'Last 6 months', count: last6MonthsPosts.length });
    }

    const thisMonthPosts = posts.filter(post => {
      const postDate = new Date(post.date);
      return postDate.getFullYear() === currentYear && postDate.getMonth() === currentMonth;
    });
    if (thisMonthPosts.length > 0) {
      options.push({ key: 'thismonth', label: 'This month', count: thisMonthPosts.length });
    }

    return options;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let filtered = posts;

    if (selectedTag) {
      filtered = filtered.filter(post =>
        post.tags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
      );
    }

    if (selectedTimeFilter !== 'all') {
      const now = new Date();
      switch (selectedTimeFilter) {
        case 'thisyear':
          filtered = filtered.filter(
            post => new Date(post.date).getFullYear() === now.getFullYear()
          );
          break;
        case 'last6months': {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          filtered = filtered.filter(post => new Date(post.date) >= sixMonthsAgo);
          break;
        }
        case 'thismonth':
          filtered = filtered.filter(post => {
            const postDate = new Date(post.date);
            return (
              postDate.getFullYear() === now.getFullYear() && postDate.getMonth() === now.getMonth()
            );
          });
          break;
      }
    }

    return filtered;
  }, [posts, selectedTag, selectedTimeFilter]);

  const postsToShow = selectedTag || selectedTimeFilter !== 'all' ? filteredPosts : posts;

  const clearFilters = () => {
    setSelectedTag(null);
    setSelectedTimeFilter('all');
  };

  return {
    selectedTag,
    setSelectedTag,
    selectedTimeFilter,
    setSelectedTimeFilter,
    timeFilterOptions,
    filteredPosts,
    postsToShow,
    clearFilters,
  };
}
