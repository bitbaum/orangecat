// Fixed wallet types with proper validation

import { bech32, bech32m } from 'bech32';
import bs58check from 'bs58check';

// Reality check: the DB holds wallet_type='lightning' rows (a Lightning address
// or a wallet connection has no on-chain address at all), so the union and the
// nullability below must admit them — they did not, which is why the update
// path could not be typed correctly.
type WalletType = 'address' | 'xpub' | 'lightning';

export const WALLET_BEHAVIOR_TYPE_VALUES = [
  'general',
  'recurring_budget',
  'one_time_goal',
] as const;
export type WalletBehaviorType = (typeof WALLET_BEHAVIOR_TYPE_VALUES)[number];

export const BUDGET_PERIOD_VALUES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
] as const;
export type BudgetPeriod = (typeof BUDGET_PERIOD_VALUES)[number];

type GoalStatus = 'active' | 'paused' | 'reached' | 'purchased' | 'cancelled' | 'archived';

export const WALLET_CATEGORY_VALUES = [
  'general',
  'rent',
  'food',
  'medical',
  'education',
  'emergency',
  'transportation',
  'utilities',
  'projects',
  'legal',
  'entertainment',
  'custom',
] as const;
export type WalletCategory = (typeof WALLET_CATEGORY_VALUES)[number];

// Constants for validation
import { MAX_LABEL_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/wallets/constants';

export const WALLET_CATEGORIES: Record<
  WalletCategory,
  { label: string; icon: string; description: string }
> = {
  general: {
    label: 'General',
    icon: '💰',
    description: 'General purpose funding',
  },
  rent: {
    label: 'Rent & Housing',
    icon: '🏠',
    description: 'Help cover housing costs',
  },
  food: {
    label: 'Food & Groceries',
    icon: '🍔',
    description: 'Support daily nutrition',
  },
  medical: {
    label: 'Medical & Healthcare',
    icon: '💊',
    description: 'Medical expenses and healthcare',
  },
  education: {
    label: 'Education',
    icon: '🎓',
    description: 'School fees and learning materials',
  },
  emergency: {
    label: 'Emergency Fund',
    icon: '🚨',
    description: 'Urgent unexpected expenses',
  },
  transportation: {
    label: 'Transportation',
    icon: '🚗',
    description: 'Travel and commute costs',
  },
  utilities: {
    label: 'Utilities',
    icon: '💡',
    description: 'Power, water, internet bills',
  },
  projects: {
    label: 'Projects & Initiatives',
    icon: '🚀',
    description: 'Fund specific projects or initiatives',
  },
  legal: {
    label: 'Legal & Advocacy',
    icon: '⚖️',
    description: 'Legal fees and advocacy work',
  },
  entertainment: {
    label: 'Entertainment & Arts',
    icon: '🎭',
    description: 'Arts, entertainment, and creative projects',
  },
  custom: {
    label: 'Other',
    icon: '📦',
    description: 'Custom category',
  },
};

// Allowed emojis for icons (whitelist for security)
export const ALLOWED_CATEGORY_ICONS = [
  '💰',
  '🏠',
  '🍔',
  '💊',
  '🎓',
  '🚨',
  '🚗',
  '💡',
  '🚀',
  '⚖️',
  '🎭',
  '📦',
] as const;

export interface Wallet {
  id: string;
  profile_id: string | null;
  project_id: string | null;
  user_id: string | null;

  label: string;
  description: string | null;

  address_or_xpub: string | null;
  wallet_type: WalletType;
  lightning_address: string | null;
  /** Encrypted at rest; never rendered. Present only on owner reads. */
  nwc_connection_uri?: string | null;

  category: WalletCategory;
  category_icon: string;

  // Behavior type determines how this wallet works
  behavior_type: WalletBehaviorType;

  // For recurring budgets
  budget_amount: number | null;
  budget_currency: string | null;
  budget_period: BudgetPeriod | null;
  budget_period_start_day: number | null;
  budget_reset_day: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  current_period_spent: number | null;
  alert_threshold_percent: number | null;
  alert_sent_at: string | null;

  // For one-time goals (replaces old goal_* fields)
  goal_amount: number | null;
  goal_currency: string | null;
  goal_deadline: string | null;
  goal_status: GoalStatus | null;
  goal_reached_at: string | null;
  goal_purchased_at: string | null;
  purchase_notes: string | null;
  milestone_25_reached_at: string | null;
  milestone_50_reached_at: string | null;
  milestone_75_reached_at: string | null;
  milestone_100_reached_at: string | null;

  // Social features for goals
  is_public_goal: boolean;
  allow_contributions: boolean;
  contribution_count: number;

  // Balance tracking
  balance_btc: number;
  balance_updated_at: string | null;

  // Analytics
  last_transaction_at: string | null;
  transaction_count: number;
  total_received: number;
  total_spent: number;

  // Display settings
  is_active: boolean;
  display_order: number;
  is_primary: boolean;
  /** Owner opt-in: publish this wallet's balance and transactions publicly. */
  open_accounting: boolean;

  created_at: string;
  updated_at: string;
}

export interface WalletFormData {
  label: string;
  description?: string | null;
  address_or_xpub?: string | null;
  lightning_address?: string | null;
  /** Nostr Wallet Connect URI (write-only secret). */
  nwc_connection_uri?: string | null;
  category: WalletCategory;
  category_icon?: string;
  behavior_type: WalletBehaviorType;

  // For recurring budgets
  budget_amount?: number | null;
  budget_currency?: string;
  budget_period?: BudgetPeriod | null;
  alert_threshold_percent?: number;

  // For one-time goals
  goal_amount?: number | null;
  goal_currency?: string | null;
  goal_deadline?: string | null;
  is_public_goal?: boolean;
  allow_contributions?: boolean;

  is_primary?: boolean;
  open_accounting?: boolean;
}

interface ValidationResult {
  valid: boolean;
  error: string | null;
  type?: WalletType;
}

/** What a pasted wallet string turned out to be — so the UI can route it to the
 *  right receive field without the user knowing Bitcoin-address vs Lightning
 *  address vs NWC. 'unknown' = not recognized (yet). */
export type WalletInputKind = 'onchain' | 'xpub' | 'lightning' | 'nwc' | 'unknown';

/**
 * Classify anything a user pastes into the "add wallet" box. The whole point is
 * that they paste WHATEVER their wallet gives them and it just works.
 */
export function classifyWalletInput(raw: string): WalletInputKind {
  const v = (raw ?? '').trim();
  if (!v) {
    return 'unknown';
  }
  if (v.toLowerCase().startsWith('nostr+walletconnect://')) {
    return 'nwc';
  }
  // Lightning address / LNURL: local@domain.tld
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return 'lightning';
  }
  const res = validateAddressOrXpub(v);
  if (res.valid) {
    return res.type === 'xpub' ? 'xpub' : 'onchain';
  }
  return 'unknown';
}

/**
 * Detect wallet type from address/xpub string
 */
export function detectWalletType(addressOrXpub: string): WalletType {
  const input = addressOrXpub.trim();

  // Check for xpub/ypub/zpub prefixes
  const xpubPrefixes = ['xpub', 'ypub', 'zpub', 'tpub', 'upub', 'vpub'];
  if (xpubPrefixes.some(prefix => input.startsWith(prefix))) {
    return 'xpub';
  }

  return 'address';
}

/**
 * Validate Bitcoin address using proper checksum validation
 * Supports: P2PKH, P2SH, P2WPKH (bech32), P2TR (taproot)
 */
/**
 * Full cryptographic address validation — base58check checksum for legacy/P2SH,
 * bech32/bech32m checksum for segwit/taproot — built on the two tiny CJS
 * decoders already in the tree. Deliberately NOT bitcoinjs-lib here: taproot
 * validation there requires initEccLib (wasm), and this function runs in the
 * BROWSER (wallet form), where a wasm dependency is a bundle hazard. It also
 * replaces the ESM-only bitcoin-address-validation package, which jest could
 * never load (its global mock validated every string as true).
 */
function isValidBitcoinAddress(
  address: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): boolean {
  // Bech32 (bc1q... segwit v0) / bech32m (bc1p... taproot v1+), per BIP173/350.
  const hrp = network === 'testnet' ? 'tb' : 'bc';
  if (address.toLowerCase().startsWith(`${hrp}1`)) {
    for (const codec of [bech32, bech32m]) {
      try {
        const { prefix, words } = codec.decode(address);
        if (prefix !== hrp) {
          return false;
        }
        const version = words[0];
        const program = codec.fromWords(words.slice(1));
        // BIP350: version 0 must be bech32 (20/32-byte program); v1+ bech32m.
        if (version === 0) {
          return codec === bech32 && (program.length === 20 || program.length === 32);
        }
        return codec === bech32m && version <= 16 && program.length >= 2 && program.length <= 40;
      } catch {
        // Wrong codec for this checksum — try the other.
      }
    }
    return false;
  }

  // Base58check: P2PKH / P2SH with version byte per network.
  try {
    const decoded = bs58check.decode(address);
    if (decoded.length !== 21) {
      return false;
    }
    const versionByte = decoded[0];
    return network === 'testnet'
      ? versionByte === 0x6f || versionByte === 0xc4
      : versionByte === 0x00 || versionByte === 0x05;
  } catch {
    return false;
  }
}

/**
 * Validate xpub/ypub/zpub with proper base58check verification
 */
function isValidXpub(xpub: string): boolean {
  try {
    // Mainnet only. Testnet keys (tpub/upub/vpub) used to be accepted here,
    // which let a user save a key this platform can never derive a payable
    // mainnet address from — receiving then failed at invoice time instead of
    // at save time, where the mistake is actually fixable.
    const validPrefixes = ['xpub', 'ypub', 'zpub'];

    if (!validPrefixes.some(prefix => xpub.startsWith(prefix))) {
      return false;
    }

    // Verify base58check encoding and checksum
    const decoded = bs58check.decode(xpub);

    // Extended public keys should be 78 bytes when decoded
    if (decoded.length !== 78) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Comprehensive validation for address or xpub
 */
export function validateAddressOrXpub(
  input: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): ValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, error: 'Address or xpub is required' };
  }

  const type = detectWalletType(trimmed);

  if (type === 'xpub') {
    if (!isValidXpub(trimmed)) {
      return {
        valid: false,
        error:
          'Invalid extended public key. It must be a mainnet xpub, ypub, or zpub with a valid checksum — testnet keys (tpub/upub/vpub) cannot receive real Bitcoin here.',
      };
    }
    return { valid: true, type: 'xpub', error: null };
  }

  // Validate Bitcoin address
  if (!isValidBitcoinAddress(trimmed, network)) {
    return {
      valid: false,
      error:
        'Invalid Bitcoin address format or checksum. Supported: Legacy (1...), SegWit (3... or bc1q...), Taproot (bc1p...)',
    };
  }

  return { valid: true, type: 'address', error: null };
}

/**
 * Sanitize user input for safe storage
 */
export function sanitizeWalletInput(data: WalletFormData): WalletFormData {
  return {
    ...data,
    label: data.label.trim().slice(0, MAX_LABEL_LENGTH),
    description: data.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH) || undefined,
    address_or_xpub: data.address_or_xpub?.trim() ?? null,
    nwc_connection_uri: data.nwc_connection_uri?.trim() || null,
    category_icon: (ALLOWED_CATEGORY_ICONS as readonly string[]).includes(data.category_icon || '')
      ? data.category_icon
      : WALLET_CATEGORIES[data.category].icon,
    goal_amount:
      data.goal_amount && data.goal_amount > 0
        ? Math.min(data.goal_amount, 1_000_000_000)
        : undefined,
  };
}
