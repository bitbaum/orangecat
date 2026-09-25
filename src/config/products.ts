/**
 * Product Entity Configuration - Single Source of Truth
 *
 * Option arrays for product types and fulfillment types.
 * Shared between entity-config field definitions and Zod validation schemas.
 */

// ==================== PRODUCT TYPES ====================

export const PRODUCT_TYPES = [
  {
    value: 'physical',
    label: 'Physical Product',
    description:
      'Something that exists in the world and has to reach the buyer — a print, a mug, a book.',
  },
  {
    value: 'digital',
    label: 'Digital Product',
    description: 'A file or a link — a photo, an e-book, a template, a recording.',
  },
  {
    value: 'service',
    label: 'Service',
    description: 'Your time or skill, sold as a fixed package.',
  },
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number]['value'];

// ==================== FULFILLMENT TYPES ====================

/**
 * How the buyer gets what they paid for. Nothing on OrangeCat delivers
 * automatically today — no code reads this field — so each description says
 * who does the delivering, which is always the seller. It used to promise
 * "System delivers digital files instantly", a feature that does not exist.
 */
export const PRODUCT_FULFILLMENT_TYPES = [
  {
    value: 'manual',
    label: 'I ship or hand it over',
    description:
      'After each payment you get a notification, and you send or hand the item to the buyer yourself.',
  },
  {
    value: 'digital',
    label: 'I send a file or link',
    description:
      'After each payment you send the buyer the file or download link yourself. OrangeCat does not host or send files yet.',
  },
  {
    value: 'automatic',
    label: 'Automatic',
    description: 'Delivery without you — not available on OrangeCat yet.',
  },
] as const;

export type ProductFulfillmentType = (typeof PRODUCT_FULFILLMENT_TYPES)[number]['value'];

/**
 * What the product form offers. `automatic` stays VALID (the database allows
 * it and loans use it) but is not offered for a product until something
 * actually delivers; no live product uses it.
 */
export const PRODUCT_FULFILLMENT_CHOICES = PRODUCT_FULFILLMENT_TYPES.filter(
  t => t.value !== 'automatic'
);

// ==================== PRODUCT STATUSES ====================

export const PRODUCT_STATUSES = ['draft', 'active', 'paused', 'sold_out'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
