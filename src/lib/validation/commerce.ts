import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';
import { CAUSE_CATEGORIES, CAUSE_STATUSES, DISTRIBUTION_RULE_TYPES } from '@/config/causes';
import { PRODUCT_TYPES, PRODUCT_FULFILLMENT_TYPES, PRODUCT_STATUSES } from '@/config/products';
import { SERVICE_LOCATION_TYPES, SERVICE_STATUSES } from '@/config/services';
import { DAYS_OF_WEEK } from '@/config/schedule';
import {
  lightningAddressSchema,
  optionalText,
  optionalUrl,
  webUrl,
  publicBitcoinAddress,
} from './base';
import { ENTITY_STATUS } from '@/config/database-constants';

// =============================================================================
// REUSABLE SUB-SCHEMAS FOR JSON FIELDS
// =============================================================================

/**
 * Availability schedule for services.
 * Matches AvailabilitySchedule interface in domain/commerce/service.ts.
 * Stored as JSONB in the database.
 *
 * Uses .passthrough() to allow additional fields without breaking existing data.
 */
const availabilityScheduleSchema = z
  .object({
    days: z.array(z.enum(DAYS_OF_WEEK)).optional(),
    hours: z
      .array(
        z.object({
          start: z.string().max(10),
          end: z.string().max(10),
        })
      )
      .optional(),
    timezone: z.string().max(100).optional(),
  })
  .passthrough();

/**
 * Distribution rules for causes.
 * Matches DistributionRules interface in domain/commerce/service.ts.
 * Stored as JSONB in the database.
 *
 * Uses .passthrough() to allow additional fields without breaking existing data.
 */
const distributionRulesSchema = z
  .object({
    type: z.enum(DISTRIBUTION_RULE_TYPES).optional(),
    allocations: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

/**
 * Beneficiary in a cause.
 * Matches Beneficiary interface in domain/commerce/service.ts.
 * Stored as JSONB array in the database.
 *
 * Uses .passthrough() to allow additional fields without breaking existing data.
 */
const beneficiarySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
    share: z.number().min(0).max(100).optional(),
  })
  .passthrough();

// Personal Economy validation schemas
export const userProductSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
  description: optionalText(1000),
  // Price interpretation:
  // - BTC (default per CLAUDE.md SSOT): decimal value, e.g. 0.001 = 0.001 BTC.
  //   Stored as NUMERIC(18,8) in the DB to avoid floating-point drift.
  // - Fiat: decimal value in currency units, e.g. 9.99 = $9.99.
  // (SATS is supported only as a *display* currency at the UI layer, not
  // as a storage unit for new prices.)
  price: z.number().positive('Price must be positive'),
  currency: z.enum(CURRENCY_CODES).optional(),
  product_type: z
    .enum(PRODUCT_TYPES.map(t => t.value) as [string, ...string[]])
    .default('physical'),
  images: z.array(webUrl()).optional().default([]),
  thumbnail_url: optionalUrl(),
  inventory_count: z.number().int().min(-1).default(-1), // -1 = unlimited
  fulfillment_type: z
    .enum(PRODUCT_FULFILLMENT_TYPES.map(t => t.value) as [string, ...string[]])
    .default('manual'),
  category: optionalText(50),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(PRODUCT_STATUSES).default(ENTITY_STATUS.DRAFT),
  is_featured: z.boolean().default(false),
  // Whether this product shows on the owner's public profile (DB column
  // show_on_profile, default true). Optional/no-default so it round-trips edits
  // and never re-injects on a partial update; create-form default lives in the
  // entity config. Was absent → the form checkbox was silently stripped by zod.
  show_on_profile: z.boolean().optional(),
});

export const userServiceSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
    description: optionalText(1000),
    category: z.string().min(1, 'Category is required').max(50),
    hourly_rate: z.number().positive().optional().nullable(),
    fixed_price: z.number().positive().optional().nullable(),
    currency: z.enum(CURRENCY_CODES).optional(),
    duration_minutes: z.number().positive().optional().nullable(),
    availability_schedule: availabilityScheduleSchema.optional().nullable(),
    service_location_type: z
      .enum(SERVICE_LOCATION_TYPES.map(t => t.value) as [string, ...string[]])
      .default('remote'),
    service_area: optionalText(200),
    images: z.array(webUrl()).optional().default([]),
    portfolio_links: z.array(webUrl()).optional().default([]),
    show_on_profile: z.boolean().optional().default(true),
    status: z.enum(SERVICE_STATUSES).default(ENTITY_STATUS.DRAFT),
  })
  .superRefine((data, ctx) => {
    if (!data.hourly_rate && !data.fixed_price) {
      // Flag BOTH price fields: the form shows only one at a time (hourly vs
      // fixed toggle), so the error must land on whichever is visible.
      const message = 'At least one pricing method (hourly or fixed) is required';
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['hourly_rate'] });
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['fixed_price'] });
    }
  });

export const userCauseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
  description: optionalText(1000),
  cause_category: z.enum(CAUSE_CATEGORIES),
  goal_amount: z.number().positive().optional().nullable(),
  currency: z.enum(CURRENCY_CODES).optional(),
  bitcoin_address: publicBitcoinAddress(),
  lightning_address: lightningAddressSchema,
  distribution_rules: distributionRulesSchema.optional().nullable(),
  beneficiaries: z.array(beneficiarySchema).optional().default([]),
  status: z.enum(CAUSE_STATUSES).default(ENTITY_STATUS.DRAFT),
  // Public-profile visibility toggle (DB show_on_profile, default true). Optional/
  // no-default — see userProductSchema note. Was absent → form checkbox stripped.
  show_on_profile: z.boolean().optional(),
});

// Types
export type UserProductFormData = z.infer<typeof userProductSchema>;
/** The service pricing toggle — which ONE price field the form shows. */
export type ServicePricingModel = 'hourly' | 'fixed';
export type UserServiceFormData = z.infer<typeof userServiceSchema> & {
  /** UI-only (not in the schema): zod .parse strips it, so it's never persisted. */
  pricing_model?: ServicePricingModel;
};
export type UserCauseFormData = z.infer<typeof userCauseSchema>;
