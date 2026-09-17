/**
 * Payment Domain Types
 *
 * SSOT for all payment-related types used across services, API routes, and UI.
 */

import type { EntityType } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';

// =====================================================================
// PAYMENT METHOD
// =====================================================================

export type PaymentMethod = 'nwc' | 'lightning_address' | 'onchain';
export type PaymentIntentKind = 'purchase' | 'support' | 'tip';

// =====================================================================
// PAYMENT INTENT
// =====================================================================

export type PaymentIntentStatus =
  (typeof STATUS.PAYMENT_INTENTS)[keyof typeof STATUS.PAYMENT_INTENTS];

export interface PaymentIntent {
  id: string;
  buyer_id: string | null;
  seller_id: string;
  entity_type: EntityType;
  entity_id: string;
  amount_btc: number;
  payment_method: PaymentMethod;
  intent_kind: PaymentIntentKind;
  receiving_wallet_id: string | null;
  bolt11: string | null;
  payment_hash: string | null;
  onchain_address: string | null;
  /** LUD-21 verify URL — enables trustless settlement detection for lightning_address */
  lnurl_verify_url: string | null;
  status: PaymentIntentStatus;
  description: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  public_status_token_hash: string | null;
}

// =====================================================================
// ORDER
// =====================================================================

type OrderStatus = (typeof STATUS.ORDERS)[keyof typeof STATUS.ORDERS];

export interface Order {
  id: string;
  payment_intent_id: string;
  buyer_id: string;
  seller_id: string;
  entity_type: EntityType;
  entity_id: string;
  amount_btc: number;
  entity_title: string;
  status: OrderStatus;
  shipping_address_id: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  buyer_note: string | null;
  seller_note: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// CONTRIBUTION
// =====================================================================

export interface Contribution {
  id: string;
  payment_intent_id: string;
  contributor_id: string | null;
  entity_type: EntityType;
  entity_id: string;
  amount_btc: number;
  message: string | null;
  is_anonymous: boolean;
  created_at: string;
}

// =====================================================================
// SERVICE INPUT/OUTPUT TYPES
// =====================================================================

export interface InitiatePaymentInput {
  entity_type: EntityType;
  entity_id: string;
  /** Required for contributions, ignored for fixed_price (uses entity's price_btc) */
  amount_btc?: number;
  /** Optional message for contributions */
  message?: string;
  /** Whether contribution is anonymous */
  is_anonymous?: boolean;
  /** Shipping address ID for physical products */
  shipping_address_id?: string;
  /** Optional buyer note */
  buyer_note?: string;
}

export interface InitiatePaymentResult {
  payment_intent: PaymentIntent;
  order?: Order;
  contribution?: Contribution;
  /** QR code data string (bolt11 uppercased for Lightning, bitcoin: URI for on-chain) */
  qr_data: string;
  /** Human-readable payment method label */
  method_label: string;
  /** Seconds until invoice expires */
  expires_in_seconds: number | null;
}

export interface PaymentStatusResult {
  status: PaymentIntentStatus;
  paid_at: string | null;
}

export interface InitiatePublicSupportInput {
  entity_type: EntityType;
  entity_id: string;
  amount_btc: number;
}

export interface InitiatePublicSupportResult {
  payment_intent: Pick<
    PaymentIntent,
    'id' | 'amount_btc' | 'payment_method' | 'status' | 'expires_at'
  > & {
    can_acknowledge: boolean;
  };
  status_token: string;
  qr_data: string;
  method_label: string;
  expires_in_seconds: number | null;
}

export interface PublicPaymentStatusResult extends PaymentStatusResult {
  requires_recipient_confirmation: boolean;
}

export interface InitiateTipInput {
  /** Auth user id of the person being tipped (the payment intent's seller_id). */
  recipientUserId: string;
  /** Display name, for the invoice/description. */
  recipientName: string;
  /** The recipient's own resolved wallet — funds go straight here. */
  wallet: ResolvedWallet;
  amountBtc: number;
}

/** Resolved wallet info for a seller */
export interface ResolvedWallet {
  method: PaymentMethod;
  wallet_id: string;
  /** NWC URI (decrypted) — only present for method=nwc */
  nwc_uri?: string;
  /**
   * Lightning address. Present for method=lightning_address, and ALSO carried
   * on a method=nwc wallet as a receive fallback.
   *
   * Why: an NWC connection can be authorised for one direction only. Coinos
   * issues send-only connections (budget + max-fee, `pay_invoice` without
   * `make_invoice`), and NWC outranks every other rail in resolution — so
   * connecting one to enable payouts made `make_invoice` fail and took the
   * owner's whole receiving path down with it. A connection that is good for
   * one direction must not disable the other.
   */
  lightning_address?: string;
  /** On-chain BTC address — only present for method=onchain */
  onchain_address?: string;
  /**
   * Extended public key (xpub/ypub/zpub) — method=onchain wallets configured
   * with a key instead of a static address. Not payable itself: invoice
   * creation must call materializeOnchainAddress() to derive a fresh,
   * never-reused address from it.
   */
  onchain_xpub?: string;
}

/**
 * Build an NWC resolution, carrying its receive fallback.
 *
 * Both resolution paths (a single wallet, and a user's whole wallet set)
 * produce this same shape; defining it once keeps the fallback from being
 * remembered in one place and forgotten in the other.
 */
export function nwcResolved(
  walletId: string,
  uri: string,
  fallback?: string | null
): ResolvedWallet {
  return {
    method: 'nwc',
    wallet_id: walletId,
    nwc_uri: uri,
    lightning_address: fallback ?? undefined,
  };
}
