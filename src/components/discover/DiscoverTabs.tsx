'use client';

import { Grid3X3, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import {
  DISCOVER_ENTITY_TAB_IDS,
  DISCOVER_TAB_TO_ENTITY,
  type DiscoverTabType,
} from '@/config/discover-tabs';

export type { DiscoverTabType };

interface DiscoverTabsProps {
  activeTab: DiscoverTabType;
  onTabChange: (tab: DiscoverTabType) => void;
  counts: Partial<Record<DiscoverTabType, number>>;
  loading?: boolean;
}

interface TabConfig {
  id: DiscoverTabType;
  label: string;
  Icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'all', label: 'All', Icon: Grid3X3 },
  ...DISCOVER_ENTITY_TAB_IDS.map(id => {
    const meta = ENTITY_REGISTRY[DISCOVER_TAB_TO_ENTITY[id]!];
    return { id, label: meta.namePlural, Icon: meta.icon };
  }),
  { id: 'profiles', label: 'People', Icon: Users },
];

export default function DiscoverTabs({
  activeTab,
  onTabChange,
  counts,
  loading = false,
}: DiscoverTabsProps) {
  const allCount = Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);

  return (
    <div className="rounded-t-lg border-b border-default bg-surface-base px-4 py-3 sm:px-6">
      <label htmlFor="discover-type" className="sr-only">
        Filter results by type
      </label>
      <select
        id="discover-type"
        value={activeTab}
        onChange={event => onTabChange(event.target.value as DiscoverTabType)}
        className="min-h-11 w-full rounded-lg border border-default bg-surface-base px-3 text-base font-medium text-fg-primary sm:hidden"
        aria-label="Filter results by type"
      >
        {tabs.map(({ id, label }) => {
          const count = id === 'all' ? allCount : counts[id] || 0;
          return (
            <option key={id} value={id}>
              {label}{!loading && count > 0 ? ` (${count})` : ''}
            </option>
          );
        })}
      </select>

      <nav className="hidden flex-wrap gap-2 sm:flex" aria-label="Filter by type">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          const count = id === 'all' ? allCount : counts[id] || 0;

          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-fg-primary bg-fg-primary text-fg-inverted'
                  : 'border-default bg-surface-base text-fg-secondary hover:bg-surface-raised hover:text-fg-primary'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
              {!loading && count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    isActive
                      ? 'bg-fg-inverted/20 text-fg-inverted'
                      : 'bg-surface-raised text-fg-secondary'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
