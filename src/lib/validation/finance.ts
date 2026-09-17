import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';
import { ENTITY_TYPES } from '@/config/entity-registry';
import { ASSET_TYPES, RENTAL_PERIODS } from '@/config/assets';
import { LOAN_TYPES, LOAN_FULFILLMENT_TYPES } from '@/config/loans';
import { INVESTMENT_TYPES, RETURN_FREQUENCIES, RISK_LEVELS } from '@/config/investments';
import {
  WALLET_CATEGORY_VALUES,
  WALLET_BEHAVIOR_TYPE_VALUES,
  BUDGET_PERIOD_VALUES,
  ALLOWED_CATEGORY_ICONS,
} from '@/types/wallet';
import { WALLET_VISIBILITY_LEVELS } from '@/config/wallet-visibility';
import { TIP_MAX_BTC, TIP_MIN_BTC } from '@/config/tips';
import { lightningAddressSchema, optionalText, webUrl } from './base';

/**
 * Collateral item for loans.
 * Matches CollateralItem interface in components/create/collateral/CollateralSelector.tsx
 * and the shape used in domain/loans/service.ts.
 * Stored as JSONB array in the database.
 *
 * Uses .passthrough() to allow additional fields without breaking existing data.
 */
const collateralItemSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().max(50).optional(),
    name: z.string().max(200).optional(),
    value: z.number().min(0).optional(),
    currency: z.string().max(10).optional(),
    description: z.string().max(500).optional(),
    metadata: z
      .object({
        verification_status: z.string().optional(),
        balance_btc: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Asset validation
export const assetSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters'),
  type: z.enum(ASSET_TYPES.map(t => t.value) as [string, ...string[]]),
  description: optionalText(2000),
  location: optionalText(200),
  estimated_value: z.number().positive().optional().nullable(),
  currency: z.enum(CURRENCY_CODES).optional(),
  documents: z.array(webUrl()).optional().nullable().default([]),

  // Sale options
  is_for_sale: z.boolean().optional().default(false),
  sale_price_btc: z.number().positive().optional().nullable(),

  // Rental options
  is_for_rent: z.boolean().optional().default(false),
  rental_price_btc: z.number().positive().optional().nullable(),
  rental_period_type: z
    .enum(RENTAL_PERIODS.map(r => r.value) as [string, ...string[]])
    .optional()
    .default('daily'),
  min_rental_period: z.number().int().positive().optional().default(1),
  max_rental_period: z.number().int().positive().optional().nullable(),

  // Deposit
  requires_deposit: z.boolean().optional().default(false),
  deposit_amount_btc: z.number().positive().optional().nullable(),

  // Visibility
  show_on_profile: z.boolean().optional().default(true),
});

/** Contact-method values (mirrors the ContactMethod type in types/loans.ts). */
export const CONTACT_METHOD_VALUES = ['platform', 'email', 'phone'] as const;

/**
 * Loan validation — the SINGLE source of truth for the loan create/update
 * contract. Covers every creatable/updatable column on the `loans` row so the
 * `/api/loans` handlers (and the update-payload builder) receive the full set;
 * the create/edit dialog validates against a projection of this schema
 * (components/loans/validation.ts).
 *
 * Listing toggles (is_public / is_negotiable / contact_method / currency) are
 * intentionally optional with NO default here: the shared schema also validates
 * partial PUT updates, and a schema default would silently re-apply on a partial
 * edit and clobber a stored value (see app/api/loans/[id]/route.ts). The dialog
 * projection re-adds the create-form defaults.
 */
export const loanSchema = z.object({
  // Loan type: new_request (seeking new loan) or existing_refinance (refinancing existing)
  loan_type: z.enum(LOAN_TYPES.map(t => t.value) as [string, ...string[]]).default('new_request'),

  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters'),
  // Optional to match the dialog/domain (which tolerate an empty description);
  // this is what retired the description-padding workaround in the API client.
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
  loan_category_id: optionalText(),
  original_amount: z.number().positive('Amount must be greater than 0'),
  remaining_balance: z.number().positive('Balance must be greater than 0'),
  interest_rate: z.number().min(0).max(100).optional().nullable(),
  monthly_payment: z.number().min(0).optional().nullable(),
  currency: z.enum(CURRENCY_CODES).optional(),

  // Bitcoin payment addresses
  bitcoin_address: optionalText(),
  lightning_address: lightningAddressSchema,
  fulfillment_type: z
    .enum(LOAN_FULFILLMENT_TYPES.map(t => t.value) as [string, ...string[]])
    .default('manual'),

  // Listing / marketplace fields (persisted on the loans row; surfaced on the
  // public detail + marketplace). Optional, no default — see note above.
  // String fields use optionalText so an edit can round-trip a saved row whose
  // unset columns come back as `null` (a bare `.optional()` rejects null).
  lender_name: optionalText(100),
  loan_number: optionalText(100),
  origination_date: optionalText(),
  maturity_date: optionalText(),
  is_public: z.boolean().optional(),
  is_negotiable: z.boolean().optional(),
  // Whether this loan appears on the owner's public profile page (loans.show_on_profile,
  // DB default true). Optional with NO default here — same reasoning as is_public above:
  // the shared schema also validates partial PUT updates. The create-form default lives
  // in loanConfig.defaultValues / the dialog projection.
  show_on_profile: z.boolean().optional(),
  minimum_offer_amount: z.number().min(0).optional().nullable(),
  preferred_terms: optionalText(1000),
  contact_method: z.enum(CONTACT_METHOD_VALUES).optional(),

  // Fields specific to existing loans (refinancing)
  current_lender: optionalText(100),
  current_interest_rate: z.number().min(0).max(100).optional().nullable(),
  desired_rate: z.number().min(0).max(100).optional().nullable(),

  // Collateral (array of collateral items)
  collateral: z.array(collateralItemSchema).optional().default([]),
});

// Investment validation
export const investmentSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be at most 100 characters'),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description must be at most 2000 characters'),
    investment_type: z
      .enum(INVESTMENT_TYPES.map(t => t.value) as [string, ...string[]])
      .default('revenue_share'),
    target_amount: z.number().positive('Target amount must be greater than 0'),
    minimum_investment: z.number().positive('Minimum investment must be greater than 0'),
    maximum_investment: z.number().positive().optional().nullable(),
    expected_return_rate: z.number().min(0).max(1000).optional().nullable(),
    return_frequency: z
      .enum(RETURN_FREQUENCIES.map(f => f.value) as [string, ...string[]])
      .optional()
      .nullable(),
    term_months: z.number().int().positive().optional().nullable(),
    end_date: optionalText(),
    risk_level: z
      .enum(RISK_LEVELS.map(r => r.value) as [string, ...string[]])
      .optional()
      .nullable(),
    terms: optionalText(5000),
    is_public: z.boolean().optional().default(false),
    bitcoin_address: optionalText(),
    lightning_address: lightningAddressSchema,
    currency: z.enum(CURRENCY_CODES).optional(),
  })
  .refine(
    data =>
      !data.maximum_investment ||
      !data.minimum_investment ||
      data.minimum_investment <= data.maximum_investment,
    {
      message: 'Maximum investment must be greater than or equal to minimum investment',
      path: ['maximum_investment'],
    }
  );

// ---------------------------------------------------------------------------
// Wallet validation
// ---------------------------------------------------------------------------

/** Schema for POST /api/wallets — create a new wallet */
export const walletCreateSchema = z
  .object({
    // Entity ownership — exactly one must be provided
    profile_id: z.string().guid('Invalid profile ID format').optional(),
    project_id: z.string().guid('Invalid project ID format').optional(),

    // Core fields
    label: z
      .string()
      .min(1, 'Wallet name is required')
      .max(100, 'Wallet name must be 100 characters or less'),
    description: z
      .string()
      .max(500, 'Description must be 500 characters or less')
      .optional()
      .nullable(),
    address_or_xpub: z.string().max(200).optional().nullable(),
    lightning_address: z.string().max(200).optional().nullable(),
    // Nostr Wallet Connect URI — the payment engine's highest-priority receive
    // rail (walletResolutionService prefers it), but until now there was no
    // self-serve way to save one. It carries a secret, so it's write-only:
    // validated for shape here, never echoed back or logged.
    nwc_connection_uri: z
      .string()
      .max(2000)
      .refine(v => v.startsWith('nostr+walletconnect://'), {
        message: 'NWC URI must start with nostr+walletconnect://',
      })
      .optional()
      .nullable(),

    // Category
    category: z.enum(WALLET_CATEGORY_VALUES).default('general'),
    category_icon: z.enum(ALLOWED_CATEGORY_ICONS).optional(),

    // Behavior
    behavior_type: z.enum(WALLET_BEHAVIOR_TYPE_VALUES).default('general'),
    budget_amount: z.number().positive().optional().nullable(),
    budget_period: z.enum(BUDGET_PERIOD_VALUES).optional().nullable(),

    // Goal
    goal_amount: z
      .number()
      .positive()
      .max(1_000_000_000, 'Goal amount too large')
      .optional()
      .nullable(),
    goal_currency: z.enum(CURRENCY_CODES).optional().nullable(),
    goal_deadline: z.string().optional().nullable(),

    // Display
    is_primary: z.boolean().optional(),
    force_duplicate: z.boolean().optional(),
  })
  .refine(data => (data.profile_id && !data.project_id) || (!data.profile_id && data.project_id), {
    message: 'Exactly one of profile_id or project_id is required',
    path: ['profile_id'],
  })
  .refine(
    data =>
      (data.address_or_xpub && data.address_or_xpub.length > 0) ||
      (data.lightning_address && data.lightning_address.length > 0) ||
      (data.nwc_connection_uri && data.nwc_connection_uri.length > 0),
    {
      message: 'Provide a Bitcoin address/xpub, a Lightning address, or an NWC connection',
      path: ['address_or_xpub'],
    }
  );

/** Schema for PATCH /api/wallets/[id] — update an existing wallet */
export const walletUpdateSchema = z
  .object({
    label: z.string().min(1, 'Label cannot be empty').max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    // All three receive handles are editable. They were previously absent from
    // this schema, so Zod stripped them and PATCH silently reported success
    // while changing nothing — a user could never correct a wrong Lightning
    // address or replace a broken wallet connection. Empty string clears the
    // handle (the form sets exactly one and clears the others).
    address_or_xpub: z.string().max(200).optional().nullable(),
    lightning_address: z.string().max(200).optional().nullable(),
    nwc_connection_uri: z.string().max(1000).optional().nullable(),
    category: z.enum(WALLET_CATEGORY_VALUES).optional(),
    category_icon: z.enum(ALLOWED_CATEGORY_ICONS).optional(),
    goal_amount: z.number().positive().max(1_000_000_000).optional().nullable(),
    goal_currency: z.enum(CURRENCY_CODES).optional().nullable(),
    goal_deadline: z.string().optional().nullable(),
    is_primary: z.boolean().optional(),
    // Open accounting: publish this wallet's balance and recent transactions on
    // its public page. Off unless the owner turns it on.
    open_accounting: z.boolean().optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/** Schema for POST /api/wallets/transfer — transfer between wallets */
export const walletTransferSchema = z
  .object({
    from_wallet_id: z.string().guid('Invalid from_wallet_id format'),
    to_wallet_id: z.string().guid('Invalid to_wallet_id format'),
    amount_btc: z
      .number({ error: issue => issue.input === undefined ? 'amount_btc is required' : 'amount_btc must be a number' })
      .positive('Amount must be positive')
      .max(21_000_000, 'Amount exceeds maximum BTC supply'),
    note: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
  })
  .refine(data => data.from_wallet_id !== data.to_wallet_id, {
    message: 'Cannot transfer to the same wallet',
    path: ['to_wallet_id'],
  });

/**
 * Schema for PATCH /api/wallets/entity-visibility — set the transparency level
 * of a wallet-entity link. See src/config/wallet-visibility.ts (SSOT).
 */
export const walletVisibilitySchema = z.object({
  wallet_id: z.string().guid('wallet_id must be a valid UUID'),
  entity_type: z.enum(ENTITY_TYPES, {
    error: () => 'Invalid entity type',
  }),
  entity_id: z.string().guid('entity_id must be a valid UUID'),
  visibility: z.enum(WALLET_VISIBILITY_LEVELS, {
    error: () => 'Invalid visibility level',
  }),
});

// ==================== PAYMENT SCHEMAS ====================

/**
 * Schema for POST /api/payments — initiate a payment.
 * Matches InitiatePaymentInput in domain/payments/types.ts.
 */
export const paymentCreateSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES, {
    error: () => 'Invalid entity type',
  }),
  entity_id: z.string().guid('entity_id must be a valid UUID'),
  /** Required for contributions; ignored for fixed-price entities */
  amount_btc: z.number().positive('amount_btc must be positive').optional(),
  /** Optional message for contributions */
  message: z.string().max(500, 'Message must be at most 500 characters').optional(),
  /** Whether contribution is anonymous */
  is_anonymous: z.boolean().optional().default(false),
  /** Shipping address for physical products */
  shipping_address_id: z.string().guid('shipping_address_id must be a valid UUID').optional(),
  /** Optional buyer note */
  buyer_note: z.string().max(500, 'Buyer note must be at most 500 characters').optional(),
});

/**
 * Schema for POST /api/payments/[id] — action on a payment.
 */
export const paymentActionSchema = z.object({
  action: z.enum(['buyer_confirm', 'seller_confirm'], {
    error: () => 'Invalid payment action',
  }),
});

export const publicSupportCreateSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES, {
    error: () => 'Invalid entity type',
  }),
  entity_id: z.string().guid('entity_id must be a valid UUID'),
  // Same bounds the payer's amount field enforces — one place, so a change to
  // the range can never leave the form offering what the server rejects.
  amount_btc: z
    .number()
    .min(TIP_MIN_BTC, `Minimum support amount is ${TIP_MIN_BTC} BTC`)
    .max(TIP_MAX_BTC, `Maximum support amount is ${TIP_MAX_BTC} BTC`),
});

export const publicPaymentActionSchema = z.object({
  action: z.literal('acknowledge'),
});

// ==================== ENTITY-WALLET LINK SCHEMA ====================

/** Schema for POST /api/entity-wallets — link a wallet to an entity */
export const entityWalletLinkSchema = z.object({
  wallet_id: z.string().guid('wallet_id must be a valid UUID'),
  entity_type: z.enum(ENTITY_TYPES, {
    error: () => `entity_type must be one of: ${ENTITY_TYPES.join(', ')}`,
  }),
  entity_id: z.string().guid('entity_id must be a valid UUID'),
});

// Types
export type AssetFormData = z.infer<typeof assetSchema>;
export type LoanFormData = z.infer<typeof loanSchema>;
export type InvestmentFormData = z.infer<typeof investmentSchema>;
