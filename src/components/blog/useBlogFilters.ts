'use client';

import { useMemo, useState } from 'react';
import { BlogPost } from '@/lib/blog';
import { APP_LOCALE } from '@/utils/locale';

type TimeFilter = 'all' | 'thisyear' | 'last6months' | 'thismonth' | string;

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
    const yearMonths = Array.from(
      new Set(
        postDates.map(
          date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        )
      )
    )
      .sort()
      .reverse();

    const options = [{ key: 'all', label: 'All Time', count: posts.length }];

    if (years.includes(currentYear)) {
      const thisYearPosts = posts.filter(post => new Date(post.date).getFullYear() === currentYear);
      options.push({ key: 'thisyear', label: 'This Year', count: thisYearPosts.length });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const last6MonthsPosts = posts.filter(post => new Date(post.date) >= sixMonthsAgo);
    if (last6MonthsPosts.length > 0 && last6MonthsPosts.length < posts.length) {
      options.push({ key: 'last6months', label: 'Last 6 Months', count: last6MonthsPosts.length });
    }

    const thisMonthPosts = posts.filter(post => {
      const postDate = new Date(post.date);
      return postDate.getFullYear() === currentYear && postDate.getMonth() === currentMonth;
    });
    if (thisMonthPosts.length > 0) {
      options.push({ key: 'thismonth', label: 'This Month', count: thisMonthPosts.length });
    }

    yearMonths.forEach(yearMonth => {
      const [year, month] = yearMonth.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
        APP_LOCALE,
        {
          month: 'long',
          year: 'numeric',
        }
      );
      const monthPosts = posts.filter(post => {
        const postDate = new Date(post.date);
        return (
          postDate.getFullYear() === parseInt(year) && postDate.getMonth() === parseInt(month) - 1
        );
      });
      options.push({ key: yearMonth, label: monthName, count: monthPosts.length });
    });

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
        default:
          if (selectedTimeFilter.includes('-')) {
            const [year, month] = selectedTimeFilter.split('-');
            filtered = filtered.filter(post => {
              const postDate = new Date(post.date);
              return (
                postDate.getFullYear() === parseInt(year) &&
                postDate.getMonth() === parseInt(month) - 1
              );
            });
          }
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
