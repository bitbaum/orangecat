/**
 * WISHLIST ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for wishlist creation.
 * Wishlists allow users to create registries for any occasion (birthday, wedding,
 * personal goals, etc.) with items from OrangeCat or external sources.
 *
 * Created: 2026-01-06
 * Last Modified: 2026-01-07
 * Last Modified Summary: Cleaned up configuration and fixed validation
 */

import { Gift } from 'lucide-react';
import { wishlistSchema, type WishlistFormData } from '@/lib/validation';
import {
  wishlistGuidanceContent,
  wishlistDefaultGuidance,
} from '@/lib/entity-guidance/wishlist-guidance';
import type { FieldGroup } from '@/components/create/types';
import { WISHLIST_TEMPLATES, type WishlistTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { WALLET_FIELD_GROUP } from './wallet-field-group';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WISHLIST_TYPES } from '@/config/wishlists';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Give your wishlist a name and description',
    fields: [
      {
        name: 'title',
        label: 'Wishlist Title',
        type: 'text',
        placeholder: "e.g., Sarah's Birthday Wishlist",
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Tell people about your wishlist and what it is for...',
        rows: 4,
        colSpan: 2,
        hint: 'A good description helps contributors understand the occasion.',
      },
    ],
  },
  {
    id: 'type',
    title: 'Wishlist Type',
    description: 'Choose the type that best matches your occasion',
    fields: [
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [...WISHLIST_TYPES],
        colSpan: 1,
      },
      {
        name: 'event_date',
        label: 'Event Date',
        type: 'date',
        hint: 'Optional: When is the event? (wedding date, birthday, etc.)',
        colSpan: 1,
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Visibility Settings',
    description: 'Control who can see and contribute to your wishlist',
    fields: [
      {
        name: 'visibility',
        label: 'Visibility',
        type: 'select',
        required: true,
        options: [
          { value: 'public', label: 'Public - Anyone can find and view' },
          { value: 'unlisted', label: 'Unlisted - Only people with the link' },
          { value: 'private', label: 'Private - Only you can see' },
        ],
        colSpan: 2,
        hint: 'Public wishlists can be discovered by anyone. Unlisted requires sharing the link.',
      },
      {
        name: 'is_active',
        label: 'Active',
        type: 'checkbox',
        hint: 'Uncheck to temporarily hide your wishlist from contributors',
        colSpan: 2,
      },
    ],
  },
  // Receiving wallet — contributors pay toward wishlist items; without this
  // group the wishlist was supportable in the registry but unpayable in practice.
  WALLET_FIELD_GROUP,
  {
    id: 'media',
    title: 'Cover Image',
    description: 'Optional: Add a cover image to personalize your wishlist',
    fields: [
      {
        name: 'cover_image_url',
        label: 'Cover Image URL',
        type: 'url',
        placeholder: 'https://example.com/your-image.jpg',
        colSpan: 2,
        hint: 'Add a relevant image (engagement photo, travel destination, etc.)',
      },
    ],
  },
];

// ==================== CONFIGURATION ====================

export const wishlistConfig = createEntityConfig<WishlistFormData>({
  entityType: 'wishlist',
  name: 'Wishlist',
  namePlural: 'Wishlists',
  icon: Gift,
  colorTheme: 'rose',
  backUrl: ENTITY_REGISTRY['wishlist'].basePath,
  successUrl: `${ENTITY_REGISTRY['wishlist'].publicBasePath}/[id]`,
  pageTitle: 'Create Wishlist',
  pageDescription:
    'Create a wishlist for any occasion. Add items from OrangeCat or anywhere on the web.',
  formTitle: 'Wishlist Details',
  formDescription: 'Set up your wishlist and start adding items',
  fieldGroups,
  validationSchema: wishlistSchema,
  defaultValues: {
    title: '',
    description: '',
    type: 'general',
    // Defaults match the schema and the EntityCreationSuccess "saved as
    // draft. not visible to anyone yet" promise. User can flip on the form
    // before submit; otherwise Publish Now flips is_active to true.
    visibility: 'private',
    is_active: false,
    event_date: null,
    cover_image_url: '',
  },
  guidanceContent: wishlistGuidanceContent,
  defaultGuidance: wishlistDefaultGuidance,
  templates: WISHLIST_TEMPLATES as unknown as WishlistTemplate[],
  infoBanner: {
    title: 'Transparent Funding',
    content:
      'When you receive funds and make purchases, post proof (receipts, photos) to build trust with your supporters. Turning on open accounting for the wallet, and noting what each transaction was for, is what a transparency score measures.',
    variant: 'info',
  },
  successMessage: 'Wishlist created! Now add some items.',
  successRedirectDelay: 2000,
});
