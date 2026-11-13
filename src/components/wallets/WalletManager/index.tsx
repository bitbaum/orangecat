'use client';

/**
 * WALLET MANAGER (REFACTORED)
 *
 * Manages Bitcoin wallets for profiles and projects.
 * Split into smaller subcomponents for maintainability.
 */

import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  WalletHeader,
  WalletEmptyState,
  WalletCard,
  WalletForm,
  DeleteConfirmDialog,
} from './components';
import type { WalletManagerProps } from './types';

export function WalletManager({
  wallets,
  entityType,
  entityId,
  onAdd,
  onUpdate,
  onDelete,
  onRefresh,
  maxWallets = 10,
  isOwner = false,
  onFieldFocus,
  unusableConnectionWalletIds,
  openFor,
}: WalletManagerProps) {
  const [isAdding, setIsAdding] = useState(!!openFor);
  // The link can be read after first render (the page reads it from the URL).
  useEffect(() => {
    if (openFor) {
      setIsAdding(true);
    }
  }, [openFor]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [walletToDelete, setWalletToDelete] = useState<(typeof wallets)[0] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Validate required props after hooks
  if (!entityType) {
    logger.error('WalletManager: entityType is required');
    return <div className="oc-error-surface">Error: Entity type not configured properly</div>;
  }

  if (!entityId) {
    logger.error('WalletManager: entityId is required');
    return <div className="oc-error-surface">Error: Entity ID not configured properly</div>;
  }

  const activeWallets = wallets.filter(w => w.is_active);
  const canAddMore = activeWallets.length < maxWallets;

  const handleDelete = async () => {
    if (!walletToDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete?.(walletToDelete.id);
      setWalletToDelete(null);
    } catch {
      // Error is already handled by parent component
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <WalletHeader
        activeCount={activeWallets.length}
        maxWallets={maxWallets}
        canAddMore={canAddMore}
        isOwner={isOwner}
        isAdding={isAdding}
        hasWallets={activeWallets.length > 0}
        onAddClick={() => setIsAdding(true)}
      />

      {/* Add new wallet form */}
      {isAdding && isOwner && (
        <WalletForm
          purpose={openFor ?? 'receive'}
          onFieldFocus={onFieldFocus}
          onSubmit={async data => {
            await onAdd?.(data);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Wallet list */}
      <div className="space-y-4 sm:space-y-3">
        {activeWallets.map(wallet => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            isOwner={isOwner}
            isEditing={editingId === wallet.id}
            onEdit={() => setEditingId(wallet.id)}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={async data => {
              await onUpdate?.(wallet.id, data);
              setEditingId(null);
            }}
            onDelete={() => setWalletToDelete(wallet)}
            onRefresh={async () => {
              if (onRefresh) {
                await onRefresh(wallet.id);
              }
            }}
            onFieldFocus={onFieldFocus}
            isConnectionUnusable={unusableConnectionWalletIds?.includes(wallet.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {activeWallets.length === 0 && !isAdding && (
        <WalletEmptyState isOwner={isOwner} onAddClick={() => setIsAdding(true)} />
      )}

      {/* Delete Confirmation Dialog */}
      {walletToDelete && (
        <DeleteConfirmDialog
          wallet={walletToDelete}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setWalletToDelete(null)}
        />
      )}
    </div>
  );
}
