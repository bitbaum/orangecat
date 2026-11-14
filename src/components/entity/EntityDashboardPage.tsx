'use client';

import { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import { AlertCircle, Search, X } from 'lucide-react';
import Input from '@/components/ui/Input';
import Loading from '@/components/Loading';
import EntityListShell from '@/components/entity/EntityListShell';
import EntityList from '@/components/entity/EntityList';
import { emptyStateWithCreate } from '@/components/entity/emptyStateWithCreate';
import CommercePagination from '@/components/commerce/CommercePagination';
import BulkActionsBar from '@/components/entity/BulkActionsBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { BaseEntity, EntityConfig } from '@/types/entity';
import {
  useEntityDashboard,
  type EntityTabConfig,
  type StatusFilterConfig,
  type StatusFilterOption,
} from '@/hooks/useEntityDashboard';

// Re-export the config types from their new home so existing importers (and
// entity page configs) can keep importing them from this component.
export type { EntityTabConfig, StatusFilterConfig, StatusFilterOption };

/**
 * EntityDashboardPage — single SSOT shell for every "My X" dashboard route.
 *
 * All state/data/mutation logic lives in `useEntityDashboard`; this component
 * is the presentational shell. Add features via props; never fork the file.
 * If a real new shape appears (e.g. lender-vs-borrower split for loans),
 * surface it as a config option, not as a sibling page.
 */
interface EntityDashboardPageProps<T extends BaseEntity> {
  config: EntityConfig<T>;
  title?: string;
  description?: string;
  loadingMessage?: string;
  createButtonLabel?: string;
  limit?: number;
  /** Optional content to render above the list (e.g., info banners). */
  headerContent?: ReactNode;
  /** Optional tabs. When provided, the first tab is the default feed. */
  tabs?: EntityTabConfig[];
  /**
   * Fields to match against the search input. Field values are coerced to
   * string with `String()` and arrays are searched element-wise.
   */
  searchableFields?: Array<keyof T>;
  searchPlaceholder?: string;
  statusFilter?: StatusFilterConfig<T>;
}

export default function EntityDashboardPage<T extends BaseEntity>({
  config,
  title,
  description,
  loadingMessage,
  createButtonLabel,
  limit = 12,
  headerContent,
  tabs,
  searchableFields,
  searchPlaceholder,
  statusFilter,
}: EntityDashboardPageProps<T>) {
  const {
    user,
    authLoading,
    hydrated,
    userCurrency,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    showSelection,
    setShowSelection,
    deletingIds,
    changingStatusIds,
    activeTabId,
    setActiveTabId,
    activeTab,
    searchQuery,
    setSearchQuery,
    statusValue,
    setStatusValue,
    loading,
    error,
    page,
    total,
    setPage,
    refresh,
    filteredItems,
    isDeleting,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    handleBulkDelete,
    executeBulkDelete,
    handleStatusChange,
    handleDeleteItem,
  } = useEntityDashboard<T>({ config, limit, tabs, searchableFields, statusFilter });

  if (!hydrated || authLoading) {
    return (
      <Loading
        fullScreen
        message={loadingMessage || `Loading your ${config.namePlural.toLowerCase()}...`}
      />
    );
  }

  if (!user) {
    return null;
  }

  const allowBulkSelect = activeTab?.allowBulkSelect !== false;
  // When the user has zero items of this entity type, the empty state
  // owns the CTA — header Create button + search + status filter would
  // be ~150px of clutter above an empty list. Show them only once
  // there's something to filter / select / contrast against.
  const isEmpty = !loading && total === 0;
  const showStatusFilter = !!statusFilter && !activeTab?.hideStatusFilter && !isEmpty;
  const showSearch =
    !!searchableFields && searchableFields.length > 0 && !activeTab?.hideSearch && !isEmpty;
  // A tab's own empty state (Favorites, …) stands as written; the entity's
  // gets the create button if its config brought none — only while the
  // header's own Create button is hidden, so a screen never shows two.
  const emptyState =
    activeTab?.emptyState ??
    (isEmpty
      ? emptyStateWithCreate(config.emptyState, config, createButtonLabel)
      : config.emptyState);

  const headerActions = isEmpty ? null : (
    <div className="flex items-center gap-2">
      {allowBulkSelect && filteredItems.length > 0 && (
        <Button onClick={() => setShowSelection(!showSelection)} variant="outline" size="sm">
          {showSelection ? 'Cancel' : 'Select'}
        </Button>
      )}
      <Button href={config.createPath} className="w-full sm:w-auto">
        {createButtonLabel || `Create ${config.name}`}
      </Button>
    </div>
  );

  const filterBar =
    showSearch || showStatusFilter ? (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
        {showSearch && (
          <div className="relative flex-1 sm:flex-initial">
            <Input
              type="text"
              icon={Search}
              placeholder={searchPlaceholder || `Search ${config.namePlural.toLowerCase()}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-10 w-full sm:w-48 md:w-64"
              aria-label={`Search ${config.namePlural.toLowerCase()}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg-primary min-h-11 min-w-11 flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {showStatusFilter && (
          <select
            value={statusValue}
            onChange={e => setStatusValue(e.target.value)}
            className="px-3 py-2 border border-strong rounded-lg text-sm bg-surface-base text-fg-primary focus:outline-none focus:ring-2 focus:ring-ring focus:border-interactive w-full sm:w-auto min-w-[140px]"
            aria-label="Filter by status"
          >
            {statusFilter!.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
    ) : null;

  return (
    <>
      <EntityListShell
        title={title || config.namePlural}
        description={description}
        headerActions={headerActions}
      >
        {/* With nothing in the list yet, the empty state and its Create button
            come first and the extra card (e.g. "Open Loki") follows as the
            second route; it used to be the only button above the fold. */}
        {!isEmpty && headerContent}

        {tabs && tabs.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SegmentedControl
              label={`${config.name} view`}
              items={tabs.map(tab => ({ value: tab.id, label: tab.label, icon: tab.icon }))}
              value={activeTabId}
              onChange={setActiveTabId}
              className="sm:inline-grid sm:auto-cols-fr sm:grid-flow-col"
            />
            {filterBar}
          </div>
        ) : (
          filterBar && <div className="mb-4">{filterBar}</div>
        )}

        {error ? (
          <div className="oc-error-surface flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Failed to load</p>
              <p className="mt-1 text-sm text-status-negative">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refresh()} className="mt-3">
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <>
            {showSelection && filteredItems.length > 0 && allowBulkSelect && (
              <div className="oc-list-row mb-4 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-fg-primary">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                    onChange={() => toggleSelectAll(filteredItems.map(item => item.id))}
                    className="h-4 w-4 rounded border-strong bg-surface-base text-fg-primary focus:ring-ring"
                  />
                  <span>Select All</span>
                </label>
              </div>
            )}
            <EntityList
              items={filteredItems}
              isLoading={loading}
              makeHref={config.makeHref}
              entityType={config.entityType}
              makeCardProps={item => config.makeCardProps(item, userCurrency)}
              emptyState={emptyState}
              gridCols={config.gridCols}
              selectedIds={showSelection && allowBulkSelect ? selectedIds : undefined}
              onToggleSelect={showSelection && allowBulkSelect ? toggleSelect : undefined}
              showSelection={showSelection && allowBulkSelect}
              onDeleteItem={handleDeleteItem}
              deletingIds={deletingIds}
              onStatusChange={config.entityType ? handleStatusChange : undefined}
              changingStatusIds={changingStatusIds}
            />
            <CommercePagination page={page} limit={limit} total={total} onPageChange={setPage} />
          </>
        )}

        {isEmpty && headerContent}
      </EntityListShell>
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClearSelection={() => {
          clearSelection();
          setShowSelection(false);
        }}
        onDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={executeBulkDelete}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? config.name : config.namePlural}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
      />
    </>
  );
}
