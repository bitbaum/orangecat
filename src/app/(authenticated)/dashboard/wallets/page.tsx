'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { cn } from '@/lib/utils';
import { GRADIENTS } from '@/config/gradients';
import { WalletManager } from '@/components/wallets/WalletManager';
import { LightningAddressCard } from '@/components/wallets/LightningAddressCard';
import { DuplicateWalletDialog } from '@/components/wallets/DuplicateWalletDialog';
import type { WalletFieldType } from '@/lib/wallet-guidance';
import { useWallets } from './hooks/useWallets';
import { useWalletOperations } from './hooks/useWalletOperations';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useReceiveStatus } from './hooks/useReceiveStatus';
import { NostrConnectionCard } from '@/components/nostr/NostrConnectionCard';
import { WalletsPageHeader } from './components/WalletsPageHeader';
import { WalletsHelpSection } from './components/WalletsHelpSection';
import { WalletsErrorState } from './components/WalletsErrorState';
import { WalletsGuidanceSidebar } from './components/WalletsGuidanceSidebar';
import { WalletsMobileGuidance } from './components/WalletsMobileGuidance';

/**
 * Dashboard Wallets Page
 *
 * Private page for users to manage their Bitcoin wallets.
 * Reuses WalletManager component following DRY principles.
 *
 * Single source of truth: WalletManager for all wallet operations
 * Separation of concerns: This page handles data fetching/API calls, WalletManager handles UI
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Refactored to use extracted hooks and components
 */
export default function DashboardWalletsPage() {
  const { user, profile, isLoading: authLoading } = useRequireAuth();
  const _router = useRouter();
  const [focusedField, setFocusedField] = useState<WalletFieldType>(null);
  const [showMobileGuidance, setShowMobileGuidance] = useState(false);

  // Custom hooks
  const { isDesktop } = useResponsiveLayout();
  const { wallets, isLoading, loadingError, refreshWallets } = useWallets({
    profileId: profile?.id,
    authLoading,
  });

  // We need to manage wallets state here to pass to the operations hook
  const [walletsState, setWalletsState] = useState(wallets);

  // Update local state when wallets change from the fetch hook
  useEffect(() => {
    setWalletsState(wallets);
  }, [wallets]);

  const {
    handleAddWallet,
    handleUpdateWallet,
    handleDeleteWallet,
    handleRefreshWallet,
    handleConfirmDuplicateWallet,
    handleCancelDuplicateWallet,
    duplicateDialog,
  } = useWalletOperations({
    userId: user?.id,
    profileId: profile?.id,
    setWallets: setWalletsState,
  });

  // What the SERVER says about being paid — the page must never assert a
  // receiving capability the payment path doesn't actually have. Re-checked
  // whenever the wallet set changes.
  const walletsSignature = walletsState
    .filter(w => w.is_active)
    .map(w => w.id)
    .join(',');
  const {
    status: receiveStatus,
    isLoading: receiveStatusLoading,
    failed: receiveStatusFailed,
    refresh: refreshReceiveStatus,
  } = useReceiveStatus(walletsSignature, !!user?.id);

  // Loading state with timeout protection
  if (authLoading || isLoading) {
    return <Loading message="Loading your wallets..." />;
  }

  if (!user) {
    return null;
  }

  // Show error state if loading failed
  if (loadingError && walletsState.length === 0) {
    return (
      <WalletsErrorState
        error={loadingError}
        onRetry={() => {
          refreshWallets();
        }}
      />
    );
  }

  return (
    <div className={cn(GRADIENTS.pageBg, 'min-h-screen')}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {/* Page Header */}
        <WalletsPageHeader />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Desktop: Guidance Sidebar */}
          <WalletsGuidanceSidebar focusedField={focusedField} />

          {/* Main Content - Wallet Manager */}
          <div className="lg:col-span-7 lg:order-1 order-1">
            {/* The user's <username>@orangecat.ch Lightning address — shown
                first so people actually learn they have one. */}
            <div className="mb-6">
              <LightningAddressCard
                status={receiveStatus}
                isLoading={receiveStatusLoading}
                failed={receiveStatusFailed}
                onRetry={() => void refreshReceiveStatus()}
              />
            </div>

            <div className="bg-surface-base rounded-lg shadow-sm border border-default p-4 sm:p-6">
              <WalletManager
                wallets={walletsState}
                entityType="profile"
                entityId={user?.id || ''}
                onAdd={handleAddWallet}
                onUpdate={handleUpdateWallet}
                onDelete={handleDeleteWallet}
                onRefresh={handleRefreshWallet}
                maxWallets={10}
                isOwner={!!user?.id && !!profile?.id}
                onFieldFocus={setFocusedField}
                unusableConnectionWalletIds={receiveStatus?.unusableConnectionWalletIds}
              />
            </div>

            {/* Nostr Wallet Connect */}
            <div className="mt-6">
              <NostrConnectionCard />
            </div>

            {/* Help Section */}
            <WalletsHelpSection isDesktop={isDesktop} />
          </div>
        </div>

        {/* Mobile Guidance */}
        <WalletsMobileGuidance
          focusedField={focusedField}
          showMobileGuidance={showMobileGuidance}
          onShowMobileGuidance={setShowMobileGuidance}
        />

        {/* Duplicate Wallet Dialog */}
        {duplicateDialog.walletData && (
          <DuplicateWalletDialog
            isOpen={duplicateDialog.isOpen}
            onClose={handleCancelDuplicateWallet}
            onConfirm={handleConfirmDuplicateWallet}
            walletData={duplicateDialog.walletData}
            existingWallets={duplicateDialog.existingWallets || []}
          />
        )}
      </div>
    </div>
  );
}
