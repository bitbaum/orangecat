/**
 * WALLET MANAGER TYPES
 */

import type { Wallet, WalletFormData } from '@/types/wallet';
import type { WalletFieldType } from '@/lib/wallet-guidance';

export interface WalletManagerProps {
  wallets: Wallet[];
  entityType: 'profile' | 'project';
  entityId: string;
  onAdd?: (wallet: WalletFormData) => Promise<void>;
  onUpdate?: (walletId: string, data: Partial<WalletFormData>) => Promise<void>;
  onDelete?: (walletId: string) => Promise<void>;
  onRefresh?: (walletId: string) => Promise<void>;
  maxWallets?: number;
  isOwner?: boolean;
  onFieldFocus?: (field: WalletFieldType) => void;
  /**
   * Wallets whose stored connection this deployment cannot use — the payment
   * path silently skips them, so the card must say so instead of implying the
   * wallet is ready to receive.
   */
  unusableConnectionWalletIds?: string[];
}

export interface WalletCardProps {
  wallet: Wallet;
  isOwner: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (data: Partial<WalletFormData>) => Promise<void>;
  onDelete: () => void;
  onRefresh: () => Promise<void>;
  onFieldFocus?: (field: WalletFieldType) => void;
  /** This wallet's stored connection can't be used — payments skip it. */
  isConnectionUnusable?: boolean;
}

export interface WalletFormProps {
  initialData?: Partial<WalletFormData>;
  onSubmit: (data: WalletFormData) => Promise<void>;
  /** Omit to hide the second button (the paste is optional, not a wall). */
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  /** Used when the name field is left blank. */
  defaultLabel?: string;
  /** Parent already asked the question, so the form heading would repeat it. */
  hideIntro?: boolean;
  onFieldFocus?: (field: WalletFieldType) => void;
  /**
   * This wallet already has a stored connection (whose secret never reaches the
   * browser). An empty input then means "keep it", not "clear it".
   */
  hasSavedConnection?: boolean;
}

export interface WalletManagerState {
  isAdding: boolean;
  editingId: string | null;
  walletToDelete: Wallet | null;
  isDeleting: boolean;
}
