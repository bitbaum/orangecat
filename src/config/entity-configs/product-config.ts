/**
 * PRODUCT ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for product creation.
 *
 * Created: 2025-12-03
 * Last Modified: 2025-12-03
 */

import { Package } from 'lucide-react';
import { ENTITY_STATUS } from '@/config/database-constants';
import { userProductSchema, type UserProductFormData } from '@/lib/validation';
import {
  productGuidanceContent,
  productDefaultGuidance,
} from '@/lib/entity-guidance/product-guidance';
import type { FieldGroup } from '@/components/create/types';
import { PRODUCT_TEMPLATES, type ProductTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WALLET_FIELD_GROUP } from './wallet-field-group';
import { PRODUCT_TYPES, PRODUCT_FULFILLMENT_CHOICES } from '@/config/products';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Essential details about your product',
    fields: [
      {
        name: 'title',
        label: 'Product Title',
        type: 'text',
        placeholder: 'e.g., Handmade Coffee Mug - 12oz Blue',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Describe your product in detail...',
        rows: 4,
        colSpan: 2,
      },
      {
        // The cover buyers see first. `images` stays the column for a gallery;
        // the public page shows both.
        name: 'thumbnail_url',
        label: 'Photo',
        type: 'image',
        colSpan: 2,
      },
      {
        name: 'category',
        label: 'Category',
        type: 'text',
        placeholder: 'e.g., Handmade, Digital, Food',
      },
      {
        name: 'product_type',
        label: 'Product Type',
        type: 'select',
        options: PRODUCT_TYPES,
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    description: 'What it costs, in the currency you think in',
    fields: [
      {
        name: 'price',
        label: 'Price',
        type: 'currency',
        placeholder: '50.00',
        required: true,
        min: 1,
        hint: 'Buyers pay in Bitcoin; they see the price in their own currency.',
        colSpan: 2,
      },
      {
        // The same value as the switch on Price, and like it, it converts the
        // price. A field of its own so "Fill with AI" can set a price in BTC.
        name: 'currency',
        label: 'Currency',
        type: 'select',
        options: [
          { value: 'CHF', label: 'Swiss Franc (CHF)' },
          { value: 'USD', label: 'US Dollar (USD)' },
          { value: 'EUR', label: 'Euro (EUR)' },
          { value: 'BTC', label: 'Bitcoin (BTC)' },
        ],
        hint: "The currency the price is set in. Changing it converts the price at today's rate. Payments settle in Bitcoin.",
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & Fulfillment',
    description: 'Manage stock and delivery',
    fields: [
      {
        name: 'inventory_count',
        label: 'Inventory Count',
        type: 'number',
        placeholder: 'Unlimited',
        min: 0,
        // Stored as -1 (unlimited); the field shows it as empty.
        emptyValue: -1,
        hint: 'Leave empty if you can always make more.',
      },
      {
        name: 'fulfillment_type',
        label: 'How the buyer gets it',
        type: 'radio',
        options: PRODUCT_FULFILLMENT_CHOICES,
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    description: 'Control where this product appears',
    fields: [
      {
        name: 'show_on_profile',
        label: 'Show on Public Profile',
        type: 'checkbox',
        hint: 'When enabled, this product will appear on your public profile page',
        colSpan: 2,
      },
    ],
  },
  WALLET_FIELD_GROUP,
];

// ==================== DEFAULT VALUES ====================

const defaultValues: UserProductFormData = {
  title: '',
  description: '',
  // Empty, not 0: a field showing "0.00" took a tap-and-type of 25 as 0.0025.
  price: undefined as unknown as number,
  currency: undefined, // Will be set from user's profile preference in EntityForm
  product_type: 'physical',
  images: [],
  thumbnail_url: '',
  inventory_count: -1,
  fulfillment_type: 'manual',
  category: '',
  tags: [],
  status: ENTITY_STATUS.DRAFT,
  is_featured: false,
  // Checked by default — matches the DB show_on_profile default and the other
  // entity configs.
  show_on_profile: true,
};

// ==================== EXPORT CONFIG ====================

export const productConfig = createEntityConfig<UserProductFormData>({
  entityType: 'product',
  name: 'Product',
  namePlural: 'Products',
  icon: Package,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['product'].basePath,
  successUrl: ENTITY_REGISTRY['product'].basePath,
  pageTitle: 'Create Product',
  pageDescription: 'Add a new product to your personal marketplace',
  formTitle: 'Product Details',
  formDescription:
    'Fill in the information for your new product. You can always edit these details later.',
  fieldGroups,
  validationSchema: userProductSchema,
  defaultValues,
  guidanceContent: productGuidanceContent,
  defaultGuidance: productDefaultGuidance,
  templates: PRODUCT_TEMPLATES as unknown as ProductTemplate[],
});
