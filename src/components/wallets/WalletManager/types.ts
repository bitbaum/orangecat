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
  /** Open the add form straight away, for this purpose (Send's "Connect a wallet"). */
  openFor?: 'send';
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
  /**
   * The save button's look. Inside an entity form it is `outline`, so the
   * form keeps one filled button (its own Create).
   */
  submitVariant?: 'primary' | 'outline';
  /** The box heading. It used to be derived from submitLabel. */
  title?: string;
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
  /**
   * The host page is already the surface (first run on /receive), so the form
   * drops its own border, background and padding: one object, one surface.
   */
  bare?: boolean;
  /**
   * Why the person is here. 'send' came from Send's "Connect a wallet": the
   * connection field is the one they need, so it opens visible and focused.
   */
  purpose?: 'receive' | 'send';
}

export interface WalletManagerState {
  isAdding: boolean;
  editingId: string | null;
  walletToDelete: Wallet | null;
  isDeleting: boolean;
}
