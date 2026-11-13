'use client';

import Button from '@/components/ui/Button';
import Loading from '@/components/Loading';
import EntityListShell from '@/components/entity/EntityListShell';
import EntityList from '@/components/entity/EntityList';
import { emptyStateWithCreate } from '@/components/entity/emptyStateWithCreate';
import CommercePagination from '@/components/commerce/CommercePagination';
import BulkActionsBar from '@/components/entity/BulkActionsBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { loanEntityConfig } from '@/config/entities/loans';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, DollarSign, Target, TrendingUp } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { AvailableLoans } from '@/components/loans/AvailableLoans';
import { IncomingLoanOffersList } from '@/components/loans/IncomingLoanOffersList';
import { LoanOffersList } from '@/components/loans/LoanOffersList';
import { useLoanList } from './useLoanList';

export default function LoansPage() {
  const {
    user,
    isLoading,
    hydrated,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    isDeleting,
    showSelection,
    setShowSelection,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    activeTab,
    switchTab,
    myLoans,
    myOffers,
    incomingOffers,
    availableLoans,
    availablePage,
    setAvailablePage,
    availableTotal,
    availablePageSize,
    loading,
    error,
    page,
    total,
    setPage,
    refresh,
    loadOffers,
    loadIncomingOffers,
    loadAvailableLoans,
    handleBulkDelete,
    executeBulkDelete,
    clearSelection,
  } = useLoanList();

  if (!hydrated || isLoading) {
    return <Loading fullScreen message="Loading your loans..." />;
  }

  if (!user) {
    return null;
  }

  const myLoansEmpty = activeTab === 'my-loans' && !loading && !error && myLoans.length === 0;

  const headerActions = (
    <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:items-center">
      {activeTab === 'my-loans' && myLoans.length > 0 && (
        <Button
          onClick={() => setShowSelection(!showSelection)}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          {showSelection ? 'Cancel' : 'Select'}
        </Button>
      )}
      {/* On an empty "My loans" the empty state owns Create, as on every
          other entity list; two primary Create buttons sat on one screen. */}
      {!myLoansEmpty && (
        <Button href={loanEntityConfig.createPath} className="w-full sm:w-auto">
          Create Loan
        </Button>
      )}
    </div>
  );

  return (
    <>
      <EntityListShell
        title="My Loans"
        description="Manage your loans, discover refinancing opportunities, and participate in peer-to-peer lending"
        headerActions={headerActions}
      >
        <Tabs
          value={activeTab}
          onValueChange={v => switchTab(v as typeof activeTab)}
          className="space-y-6"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
            <TabsTrigger
              value="my-loans"
              className="min-h-11 gap-1 px-2 text-xs sm:gap-2 sm:text-sm"
            >
              <DollarSign className="hidden h-4 w-4 sm:block" aria-hidden />
              <span>My loans</span>
              {myLoans.length > 0 && <span className="ml-1 text-xs">({myLoans.length})</span>}
            </TabsTrigger>
            <TabsTrigger
              value="available"
              className="min-h-11 gap-1 px-2 text-xs sm:gap-2 sm:text-sm"
            >
              <Target className="hidden h-4 w-4 sm:block" aria-hidden />
              <span>Browse</span>
              {availableLoans.length > 0 && (
                <span className="ml-1 text-xs">({availableLoans.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="offers" className="min-h-11 gap-1 px-2 text-xs sm:gap-2 sm:text-sm">
              <TrendingUp className="hidden h-4 w-4 sm:block" aria-hidden />
              <span>My offers</span>
              {myOffers.length > 0 && <span className="ml-1 text-xs">({myOffers.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-loans" className="space-y-6">
            {error ? (
              <div className="oc-error-surface p-6">{error}</div>
            ) : (
              <>
                {showSelection && myLoans.length > 0 && (
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-sm text-fg-primary">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === myLoans.length && myLoans.length > 0}
                        onChange={() => toggleSelectAll(myLoans.map(l => l.id))}
                        className="h-4 w-4 rounded border-strong text-fg-primary focus:ring-ring"
                      />
                      <span>Select All</span>
                    </label>
                  </div>
                )}
                <EntityList
                  items={myLoans}
                  isLoading={loading}
                  makeHref={loanEntityConfig.makeHref}
                  makeCardProps={loanEntityConfig.makeCardProps}
                  emptyState={emptyStateWithCreate(
                    loanEntityConfig.emptyState,
                    loanEntityConfig,
                    'Create Loan'
                  )}
                  gridCols={loanEntityConfig.gridCols}
                  selectedIds={showSelection ? selectedIds : undefined}
                  onToggleSelect={showSelection ? toggleSelect : undefined}
                  showSelection={showSelection}
                />
                <CommercePagination page={page} limit={12} total={total} onPageChange={setPage} />
                <IncomingLoanOffersList
                  offers={incomingOffers}
                  borrowerId={user.id}
                  onOfferUpdated={() => {
                    loadIncomingOffers();
                    refresh?.();
                    loadOffers();
                  }}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-6">
            {availableLoans.length > 0 ? (
              <>
                <AvailableLoans
                  loans={availableLoans}
                  onOfferMade={() => {
                    loadAvailableLoans();
                    loadOffers();
                  }}
                />
                <CommercePagination
                  page={availablePage}
                  limit={availablePageSize}
                  total={availableTotal}
                  onPageChange={setAvailablePage}
                />
              </>
            ) : (
              <EmptyState
                icon={Coins}
                title="No loans available"
                description="Check back later for community loan listings"
              />
            )}
          </TabsContent>

          <TabsContent value="offers" className="space-y-6">
            {myOffers.length > 0 ? (
              <LoanOffersList offers={myOffers} onOfferUpdated={loadOffers} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No offers made yet"
                description="Browse available loans to make your first refinancing offer"
                action={
                  <Button onClick={() => switchTab('available')} variant="outline">
                    Browse Available Loans
                  </Button>
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </EntityListShell>

      {activeTab === 'my-loans' && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={() => {
            clearSelection();
            setShowSelection(false);
          }}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
          entityNamePlural="loans"
        />
      )}

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={executeBulkDelete}
        title={`Delete ${selectedIds.size} loan${selectedIds.size === 1 ? '' : 's'}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
      />
    </>
  );
}
