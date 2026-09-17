'use client';

/**
 * useEntityDashboard — all state, data-fetching, and mutation logic for the
 * generic "My X" dashboard shell. Extracted from EntityDashboardPage.tsx so
 * that component stays a thin presentational shell under the 300-line limit.
 *
 * Owns: auth gate, currency, bulk selection, tab state, search/status filter,
 * the primary/secondary entity feeds, bulk delete, per-item delete + status
 * change. The component consumes the returned bundle and renders it.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { useEntityList } from '@/hooks/useEntityList';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useBulkDelete } from '@/hooks/useBulkDelete';
import { EntityConfig, BaseEntity } from '@/types/entity';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import type { LucideIcon } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export interface EntityTabConfig {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Override the default apiEndpoint for this tab (e.g., favorites feed). */
  apiEndpoint?: string;
  /** Override the empty state shown when this tab has no items. */
  emptyState?: EntityConfig<BaseEntity>['emptyState'];
  /** Bulk select toolbar visibility (default true). */
  allowBulkSelect?: boolean;
  /** Hide the status filter on this tab (default false). */
  hideStatusFilter?: boolean;
  /** Hide the search input on this tab (default false). */
  hideSearch?: boolean;
}

export interface StatusFilterOption {
  value: string;
  label: string;
}

export interface StatusFilterConfig<T extends BaseEntity> {
  options: StatusFilterOption[];
  /** Default value (defaults to 'all'). */
  defaultValue?: string;
  /** Custom match — when omitted, item.status === value is used. */
  match?: (item: T, value: string) => boolean;
}

export interface UseEntityDashboardParams<T extends BaseEntity> {
  config: EntityConfig<T>;
  limit: number;
  tabs?: EntityTabConfig[];
  /**
   * Fields to match against the search input. Field values are coerced to
   * string with `String()` and arrays are searched element-wise.
   */
  searchableFields?: Array<keyof T>;
  statusFilter?: StatusFilterConfig<T>;
}

export function useEntityDashboard<T extends BaseEntity>({
  config,
  limit,
  tabs,
  searchableFields,
  statusFilter,
}: UseEntityDashboardParams<T>) {
  const { user, isLoading: authLoading, hydrated } = useRequireAuth();
  const userCurrency = useUserCurrency();
  const { selectedIds, toggleSelect, toggleSelectAll, clearSelection } = useBulkSelection();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [changingStatusIds, setChangingStatusIds] = useState<Set<string>>(new Set());
  const [showSelection, setShowSelection] = useState(false);

  const firstTab = tabs?.[0];
  const secondTab = tabs?.[1];
  const [activeTabId, setActiveTabId] = useState<string>(firstTab?.id ?? '__default__');

  const activeTab = useMemo(() => tabs?.find(t => t.id === activeTabId), [tabs, activeTabId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusValue, setStatusValue] = useState<string>(statusFilter?.defaultValue ?? 'all');

  // Primary feed (first tab, or default when there are no tabs).
  const primary = useEntityList<T>({
    apiEndpoint: firstTab?.apiEndpoint ?? config.apiEndpoint,
    userId: user?.id,
    limit,
    enabled: !!user?.id && hydrated && !authLoading && (!tabs || activeTabId === firstTab?.id),
  });

  // Secondary feed (second tab) — only enabled while that tab is active.
  const secondary = useEntityList<T>({
    apiEndpoint: secondTab?.apiEndpoint ?? config.apiEndpoint,
    userId: user?.id,
    limit,
    enabled: !!user?.id && hydrated && !authLoading && !!secondTab && activeTabId === secondTab.id,
  });

  const current = activeTabId === secondTab?.id ? secondary : primary;
  const { items, loading, error, page, total, setPage, refresh } = current;

  const {
    isDeleting,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    handleBulkDelete,
    executeBulkDelete,
  } = useBulkDelete({
    selectedIds,
    apiEndpoint: config.apiEndpoint,
    entityName: config.name,
    entityNamePlural: config.namePlural,
    clearSelection,
    refresh,
    onSuccess: () => setShowSelection(false),
  });

  // When the active tab changes, drop any in-progress selection — selections
  // don't carry between feeds and showing them on a different tab is confusing.
  useEffect(() => {
    clearSelection();
    setShowSelection(false);
  }, [activeTabId, clearSelection]);

  // Apply search + status filters client-side. Pagination still tracks the
  // full feed total — filtered views are intended to be paginated server-side
  // in the future via `queryParams` to useEntityList.
  const filteredItems = useMemo(() => {
    let list = items;
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed && searchableFields && searchableFields.length > 0) {
      list = list.filter(item => {
        for (const field of searchableFields) {
          const value = item[field];
          if (value === null || value === undefined) {
            continue;
          }
          if (Array.isArray(value)) {
            if (value.some(v => typeof v === 'string' && v.toLowerCase().includes(trimmed))) {
              return true;
            }
          } else if (String(value).toLowerCase().includes(trimmed)) {
            return true;
          }
        }
        return false;
      });
    }
    if (statusFilter && statusValue !== 'all' && !activeTab?.hideStatusFilter) {
      const matcher =
        statusFilter.match ??
        ((it: T, v: string) => (it as unknown as { status?: string }).status === v);
      list = list.filter(item => matcher(item, statusValue));
    }
    return list;
  }, [items, searchQuery, searchableFields, statusFilter, statusValue, activeTab]);

  const handleStatusChange = useCallback(
    async (id: string, newStatus: string) => {
      if (!config.entityType) {
        return;
      }
      setChangingStatusIds(prev => new Set(prev).add(id));
      try {
        const response = await fetch(API_ROUTES.ENTITIES.STATUS(config.entityType, id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(apiErrorMessage(errorData, `Failed to update ${config.name} status`));
        }
        await refresh();
        toast.success(`${config.name} status updated`);
      } catch (err) {
        logger.error(
          `Failed to update ${config.name} status`,
          { error: err, id },
          'EntityDashboardPage'
        );
        toast.error(`Failed to update ${config.name} status. Please try again.`);
      } finally {
        setChangingStatusIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [config.entityType, config.name, refresh]
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      setDeletingIds(prev => new Set(prev).add(id));
      try {
        const response = await fetch(`${config.apiEndpoint}/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(apiErrorMessage(errorData, `Failed to delete ${config.name}`));
        }
        toast.success(`${config.name} deleted successfully`);
        await refresh();
      } catch (err) {
        logger.error(`Failed to delete ${config.name}`, { error: err, id }, 'EntityDashboardPage');
        toast.error(`Failed to delete ${config.name}. Please try again.`);
      } finally {
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [config.apiEndpoint, config.name, refresh]
  );

  return {
    // auth
    user,
    authLoading,
    hydrated,
    userCurrency,
    // selection
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    showSelection,
    setShowSelection,
    deletingIds,
    changingStatusIds,
    // tabs
    activeTabId,
    setActiveTabId,
    activeTab,
    // filters
    searchQuery,
    setSearchQuery,
    statusValue,
    setStatusValue,
    // feed
    loading,
    error,
    page,
    total,
    setPage,
    refresh,
    filteredItems,
    // bulk delete
    isDeleting,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    handleBulkDelete,
    executeBulkDelete,
    // per-item mutations
    handleStatusChange,
    handleDeleteItem,
  };
}
