/**
 * TimelineSortingControls
 *
 * The feed's sort order: pick one of three, so it is the shared
 * SegmentedControl (equal cells, 44px tall) rather than three chips, each as
 * wide as its word, which ran under the page title and off a phone screen.
 */

'use client';

import { TrendingUp, Clock, Flame } from 'lucide-react';
import { SegmentedControl, type SegmentedItem } from '@/components/ui/SegmentedControl';

export type TimelineSort = 'recent' | 'trending' | 'popular';

const SORT_ITEMS: readonly SegmentedItem<TimelineSort>[] = [
  { value: 'trending', label: 'Trending', icon: TrendingUp },
  { value: 'recent', label: 'Recent', icon: Clock },
  { value: 'popular', label: 'Popular', icon: Flame },
];

interface TimelineSortingControlsProps {
  sortBy: TimelineSort;
  onSortChange: (sort: TimelineSort) => void;
}

export function TimelineSortingControls({ sortBy, onSortChange }: TimelineSortingControlsProps) {
  return (
    <SegmentedControl
      items={SORT_ITEMS}
      value={sortBy}
      onChange={onSortChange}
      label="Sort posts"
      className="w-full"
    />
  );
}
