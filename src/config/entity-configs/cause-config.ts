/**
 * CAUSE ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for cause/charity creation.
 *
 * Created: 2025-12-03
 * Last Modified: 2025-12-03
 */

import { Heart } from 'lucide-react';
import { ENTITY_STATUS } from '@/config/database-constants';
import { userCauseSchema, type UserCauseFormData } from '@/lib/validation';
import { causeGuidanceContent, causeDefaultGuidance } from '@/lib/entity-guidance/cause-guidance';
import type { FieldGroup } from '@/components/create/types';
import { CAUSE_TEMPLATES, type CauseTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WalletSelectorField } from '@/components/create/wallet-selector';
import { CAUSE_CATEGORIES, CAUSE_CATEGORY_OPTIONS } from '@/config/causes';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Tell the story of your cause',
    fields: [
      {
        name: 'title',
        label: 'Cause Title',
        type: 'text',
        placeholder: 'e.g., Help Build a School in Guatemala',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder:
          "Describe your cause in detail - what you're raising funds for, who will benefit, how the funds will be used...",
        rows: 5,
        colSpan: 2,
      },
      {
        name: 'cause_category',
        label: 'Category',
        type: 'select',
        required: true,
        options: CAUSE_CATEGORY_OPTIONS,
        colSpan: 2,
      },
    ],
  },
  {
    id: 'goal',
    title: 'Fundraising Goal',
    description: 'Set your target amount (optional for open-ended fundraising)',
    fields: [
      {
        name: 'goal_amount',
        label: 'Goal Amount',
        type: 'currency',
        isGoal: true,
        placeholder: '10000.00',
        min: 1,
        hint: 'Leave empty for open-ended fundraising. Enter in your preferred currency.',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'payment',
    title: 'Pay into',
    description: 'Where money for this page should land',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    description: 'Control where this cause appears',
    fields: [
      {
        name: 'show_on_profile',
        label: 'Show on Public Profile',
        type: 'checkbox',
        hint: 'When enabled, this cause will appear on your public profile page',
        colSpan: 2,
      },
    ],
  },
];

// ==================== DEFAULT VALUES ====================

const defaultValues: UserCauseFormData = {
  title: '',
  description: '',
  cause_category: CAUSE_CATEGORIES[0],
  goal_amount: null,
  currency: undefined, // Will be set from user's profile preference in EntityForm
  bitcoin_address: '',
  lightning_address: '',
  beneficiaries: [],
  status: ENTITY_STATUS.DRAFT,
  // Checked by default — matches the DB show_on_profile default and other configs.
  show_on_profile: true,
};

// ==================== EXPORT CONFIG ====================

export const causeConfig = createEntityConfig<UserCauseFormData>({
  entityType: 'cause',
  name: 'Cause',
  namePlural: 'Causes',
  icon: Heart,
  colorTheme: 'rose',
  backUrl: ENTITY_REGISTRY['cause'].basePath,
  successUrl: `${ENTITY_REGISTRY['cause'].basePath}/[id]`,
  pageTitle: 'Create Cause',
  pageDescription: 'Start a cause — no-strings funding for what matters',
  formTitle: 'Cause Details',
  formDescription: 'Fill in the information for your cause. Be clear about how funds will be used.',
  fieldGroups,
  validationSchema: userCauseSchema,
  defaultValues,
  guidanceContent: causeGuidanceContent,
  defaultGuidance: causeDefaultGuidance,
  templates: CAUSE_TEMPLATES as unknown as CauseTemplate[],
  infoBanner: {
    title: 'Transparency Commitment',
    content:
      'By creating this cause, you commit to using all received funds for the stated purpose and providing updates to your supporters about how their contributions are being used.',
    variant: 'warning',
  },
});
