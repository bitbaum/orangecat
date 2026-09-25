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
    description: 'Set your product price (enter in your preferred currency)',
    fields: [
      {
        name: 'price',
        label: 'Price',
        type: 'currency',
        placeholder: '50.00',
        required: true,
        min: 1,
        hint: 'Enter in your preferred currency. All payments are in Bitcoin.',
        colSpan: 2,
      },
      {
        name: 'currency',
        label: 'Default Currency',
        type: 'select',
        options: [
          { value: 'CHF', label: 'Swiss Franc (CHF)' },
          { value: 'USD', label: 'US Dollar (USD)' },
          { value: 'EUR', label: 'Euro (EUR)' },
          { value: 'BTC', label: 'Bitcoin (BTC)' },
        ],
        hint: 'Your preferred currency for displaying prices. All transactions settle in Bitcoin.',
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
        placeholder: '-1 for unlimited',
        min: -1,
        hint: 'Use -1 for unlimited stock',
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
  price: 0,
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
