'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BlogPost } from '@/lib/blog';
import { APP_LOCALE } from '@/utils/locale';

type TimeFilter = 'all' | 'thisyear' | 'last6months' | 'thismonth' | string;

/** The query parameter a post's topic chip links with: /blog?tag=BiasLens. */
export const BLOG_TAG_PARAM = 'tag';

/**
 * A post's `date` is a calendar day ('YYYY-MM-DD', checked when the blog is
 * read). It is read as digits, never through `new Date()`: that is UTC
 * midnight, which west of Greenwich is the previous day, so a post dated the
 * 1st was filed under the previous month there, and the month labels the
 * server rendered (UTC) differed from the browser's, failing hydration (#418).
 */
export function postMonth(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(APP_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Today as 'YYYY-MM-DD' in the reader's own calendar. */
function localDay(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sixMonthsBefore(now: Date): string {
  const then = new Date(now);
  then.setMonth(then.getMonth() - 6);
  return localDay(then);
}

function matchesTime(post: BlogPost, filter: TimeFilter, today: string | null): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'thisyear':
      return today !== null && post.date.slice(0, 4) === today.slice(0, 4);
    case 'thismonth':
      return today !== null && postMonth(post.date) === postMonth(today);
    case 'last6months':
      return today !== null && post.date >= sixMonthsBefore(new Date(`${today}T12:00:00`));
    default:
      return postMonth(post.date) === filter;
  }
}

/** The tag in the URL, matched to a tag the blog has (any case), or null. */
function tagFromUrl(posts: BlogPost[]): string | null {
  const wanted = new URLSearchParams(window.location.search).get(BLOG_TAG_PARAM);
  if (!wanted) {
    return null;
  }
  const lower = wanted.toLowerCase();
  for (const post of posts) {
    const hit = post.tags.find(tag => tag.toLowerCase() === lower);
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function useBlogFilters(posts: BlogPost[]) {
  const [selectedTag, setTag] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('all');
  // "This month" and friends depend on the reader's today, which the static
  // page cannot know; they appear once the page is in the browser.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(localDay(new Date()));
    // A post's topic chip links here with ?tag=; open the blog filtered to it.
    // Read after mount, so the prerendered page stays the full list.
    setTag(tagFromUrl(posts));
  }, [posts]);

  // The filtered view has its own address, so it can be shared and reloaded.
  const setSelectedTag = useCallback((tag: string | null) => {
    setTag(tag);
    const url = new URL(window.location.href);
    if (tag) {
      url.searchParams.set(BLOG_TAG_PARAM, tag);
    } else {
      url.searchParams.delete(BLOG_TAG_PARAM);
    }
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const timeFilterOptions = useMemo(() => {
    const count = (filter: TimeFilter) => posts.filter(p => matchesTime(p, filter, today)).length;
    const options = [{ key: 'all', label: 'All Time', count: posts.length }];

    if (today) {
      const thisYear = count('thisyear');
      if (thisYear > 0) {
        options.push({ key: 'thisyear', label: 'This Year', count: thisYear });
      }
      const lastSix = count('last6months');
      if (lastSix > 0 && lastSix < posts.length) {
        options.push({ key: 'last6months', label: 'Last 6 Months', count: lastSix });
      }
      const thisMonth = count('thismonth');
      if (thisMonth > 0) {
        options.push({ key: 'thismonth', label: 'This Month', count: thisMonth });
      }
    }

    const months = Array.from(new Set(posts.map(p => postMonth(p.date))))
      .sort()
      .reverse();
    for (const month of months) {
      options.push({ key: month, label: monthLabel(month), count: count(month) });
    }
    return options;
  }, [posts, today]);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        post =>
          (!selectedTag || post.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())) &&
          matchesTime(post, selectedTimeFilter, today)
      ),
    [posts, selectedTag, selectedTimeFilter, today]
  );

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
