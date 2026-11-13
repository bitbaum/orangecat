// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const dashboard = vi.hoisted(() => ({ total: 0 }));

vi.mock('@/hooks/useEntityDashboard', () => ({
  useEntityDashboard: () => ({
    user: { id: 'u1' },
    authLoading: false,
    hydrated: true,
    userCurrency: 'CHF',
    selectedIds: new Set(),
    toggleSelect: vi.fn(),
    toggleSelectAll: vi.fn(),
    clearSelection: vi.fn(),
    showSelection: false,
    setShowSelection: vi.fn(),
    deletingIds: new Set(),
    changingStatusIds: new Set(),
    activeTabId: undefined,
    setActiveTabId: vi.fn(),
    activeTab: undefined,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusValue: '',
    setStatusValue: vi.fn(),
    loading: false,
    error: null,
    page: 1,
    total: dashboard.total,
    setPage: vi.fn(),
    refresh: vi.fn(),
    filteredItems: [],
    isDeleting: false,
    bulkDeleteConfirm: false,
    setBulkDeleteConfirm: vi.fn(),
    handleBulkDelete: vi.fn(),
    executeBulkDelete: vi.fn(),
    handleStatusChange: vi.fn(),
    handleDeleteItem: vi.fn(),
  }),
}));

import EntityDashboardPage from '@/components/entity/EntityDashboardPage';
import { wishlistEntityConfig } from '@/config/entities/wishlists';

describe('an empty "My X" list', () => {
  it('shows its Create button before any extra card', () => {
    dashboard.total = 0;
    render(
      <EntityDashboardPage
        config={wishlistEntityConfig}
        headerContent={<a href="/loki">Open Loki</a>}
      />
    );
    const create = screen.getByRole('link', { name: `Create ${wishlistEntityConfig.name}` });
    const loki = screen.getByRole('link', { name: 'Open Loki' });
    expect(create).toHaveAttribute('href', wishlistEntityConfig.createPath);
    expect(create.compareDocumentPosition(loki) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
