'use client';

/**
 * Why this codec is written by hand rather than taken from `listkit`.
 *
 * The fleet has a shared list package whose whole purpose is to replace URL
 * builders like this one, and it was evaluated here on 2026-09-12. It does not
 * fit, and the reason is worth keeping so nobody re-runs the survey: listkit
 * models a list as FACETS over a known option set, and only four of this page's
 * eight params are that. `q`, `type`, `category` and `sort` map cleanly;
 * `country`, `city` and `postal` are free text a reader types, and `radius_km`
 * is a distance around them — listkit's `range` facet is a min/max over a row's
 * own numeric field, which is a different thing.
 *
 * Adopting it anyway would leave two codecs writing one URLSearchParams inside
 * one effect, split by which half of the params each owns. That seam is worse
 * than this file. If listkit grows a free-text param kind, look again here.
 *
 * What this file no longer does is decide anything: the params and their
 * defaults live in `discoverUrlContract`, shared with the read side.
 */

import { useEffect } from 'react';
import type { useRouter, useSearchParams } from 'next/navigation';
import type { SortOption } from '@/services/search';
import type { DiscoverTabType } from '@/components/discover/DiscoverTabs';
import { discoverUrlFor } from './discoverUrlContract';

interface UseDiscoverUrlSyncOptions {
  activeTab: DiscoverTabType;
  searchTerm: string;
  selectedCategories: string[];
  sortBy: SortOption;
  country: string;
  city: string;
  postal: string;
  radiusKm: number;
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
}

export function useDiscoverUrlSync({
  activeTab,
  searchTerm,
  selectedCategories,
  sortBy,
  country,
  city,
  postal,
  radiusKm,
  router,
  searchParams,
}: UseDiscoverUrlSyncOptions) {
  useEffect(() => {
    const newUrl = discoverUrlFor(searchParams, {
      activeTab,
      searchTerm,
      selectedCategories,
      sortBy,
      country,
      city,
      postal,
      radiusKm,
    });
    const currentUrl = searchParams ? `/discover?${searchParams.toString()}` : '/discover';
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [
    activeTab,
    searchTerm,
    selectedCategories,
    sortBy,
    country,
    city,
    postal,
    radiusKm,
    router,
    searchParams,
  ]);
}
