import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';
import {
  WISHLIST_TYPES,
  WISHLIST_VISIBILITY_TYPES,
  WISHLIST_PROOF_TYPES,
  WISHLIST_FEEDBACK_TYPES,
} from '@/config/wishlists';
import { optionalText, optionalUrl, webUrl } from './base';

// =============================================================================
// WISHLIST VALIDATION
// =============================================================================

export const wishlistSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters'),
  description: optionalText(1000),
  type: z.enum(WISHLIST_TYPES.map(t => t.value) as [string, ...string[]]).default('general'),
  // New wishlists land as drafts — not visible to anyone — so the
  // EntityCreationSuccess "saved as a draft. not visible to anyone yet"
  // message and the Publish Now button reflect reality. A wishlist with
  // is_active=false is excluded from the public list query regardless of
  // visibility; visibility='private' is belt-and-braces for the case where
  // a caller flips is_active=true without going through the publish flow.
  visibility: z.enum(WISHLIST_VISIBILITY_TYPES).default('private'),
  event_date: z.string().or(z.date()).optional().nullable(),
  cover_image_url: optionalUrl(),
  is_active: z.boolean().default(false),
});

export const wishlistItemSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),
  description: optionalText(1000),
  image_url: webUrl().optional().nullable(),

  // Internal reference (mutually exclusive)
  product_id: z.string().guid().optional().nullable(),
  service_id: z.string().guid().optional().nullable(),
  asset_id: z.string().guid().optional().nullable(),

  // External reference
  external_url: webUrl().optional().nullable(),
  external_source: z.string().max(100).optional().nullable(),

  // Funding
  // BTC is the canonical unit — fractional amounts down to 1e-8. The old
  // .int('whole satoshis') gate was a sats-era leftover that rejected every
  // normal BTC value (0.001 etc.).
  // NOTE: not .multipleOf(1e-8) — zod's multipleOf uses float modulo, which
  // rejects perfectly valid values like 0.001 due to floating-point noise.
  target_amount_btc: z
    .number()
    .positive('Target amount must be positive')
    .refine(
      v => Math.abs(v * 1e8 - Math.round(v * 1e8)) < 1e-3,
      'Amount has a maximum precision of 8 decimal places'
    ),
  currency: z.enum(CURRENCY_CODES).optional().default('BTC'),
  original_amount: z.number().positive().optional().nullable(),

  // `use_dedicated_wallet` and `dedicated_wallet_address` were removed here on
  // 2026-08-26. They described a feature that was never built: contributions to
  // a wishlist item routing to their own address instead of the owner's wallet.
  //
  // Unreachable from every direction — no form field offers them, the wishlist
  // API never maps them (so nothing was ever written), no payment code reads
  // them, and their guidance copy therefore had no field to attach to either.
  // The columns exist on wishlist_items and the table holds 0 rows.
  //
  // Removed rather than rendered, for the reason the guidance copy makes plain:
  // it promises "contributions go to a dedicated address". Displaying that is a
  // statement about where someone's money goes, and it would not have been true.
  // The columns stay, so building the feature later needs no migration.

  // Options
  priority: z.number().int().min(0).max(100).default(0),
  allow_partial_funding: z.boolean().default(true),
  quantity_wanted: z.number().int().positive().default(1),
});

export const wishlistFulfillmentProofSchema = z.object({
  wishlist_item_id: z.string().guid(),
  proof_type: z.enum(WISHLIST_PROOF_TYPES),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  image_url: webUrl().optional().nullable(),
  transaction_id: z.string().max(100).optional().nullable(),
});

export const wishlistFeedbackSchema = z
  .object({
    wishlist_item_id: z.string().guid(),
    fulfillment_proof_id: z.string().guid().optional().nullable(),
    feedback_type: z.enum(WISHLIST_FEEDBACK_TYPES),
    comment: z.string().max(500).optional().nullable(),
  })
  .refine(data => data.feedback_type !== 'dislike' || (data.comment && data.comment.length >= 10), {
    message: 'Dislikes require a comment of at least 10 characters',
    path: ['comment'],
  });

// Types
export type WishlistFormData = z.infer<typeof wishlistSchema>;
export type WishlistItemFormData = z.infer<typeof wishlistItemSchema>;
export type WishlistFulfillmentProofFormData = z.infer<typeof wishlistFulfillmentProofSchema>;
export type WishlistFeedbackFormData = z.infer<typeof wishlistFeedbackSchema>;
