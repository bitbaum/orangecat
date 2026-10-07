/**
 * SERVICE ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for service creation.
 *
 * Created: 2025-12-03
 * Last Modified: 2025-12-03
 */

import { Briefcase } from 'lucide-react';
import { ENTITY_STATUS } from '@/config/database-constants';
import { userServiceSchema, type UserServiceFormData } from '@/lib/validation';
import {
  serviceGuidanceContent,
  serviceDefaultGuidance,
} from '@/lib/entity-guidance/service-guidance';
import type { FieldGroup } from '@/components/create/types';
import { SERVICE_TEMPLATES, type ServiceTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WALLET_FIELD_GROUP } from './wallet-field-group';
import { SERVICE_LOCATION_TYPES } from '@/config/services';

// ==================== CONSTANTS ====================

const SERVICE_CATEGORIES = [
  'Art & Illustration',
  'Tattoo & Body Art',
  'Beauty & Wellness',
  'Photography',
  'Video & Film',
  'Music & Audio',
  'Design',
  'Writing & Editing',
  'Consulting',
  'Coaching & Mentoring',
  'Teaching & Tutoring',
  'Development',
  'Marketing',
  'Translation',
  'Legal',
  'Accounting',
  'Other',
];

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Essential details about your service',
    fields: [
      {
        name: 'title',
        label: 'Service Title',
        type: 'text',
        placeholder: 'e.g., Bitcoin Consulting, Web Development',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder:
          'Describe your service in detail - what you offer, your experience, what clients can expect...',
        rows: 4,
        colSpan: 2,
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: SERVICE_CATEGORIES.map(cat => ({ value: cat, label: cat })),
        colSpan: 2,
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    description: 'Choose how you charge — by the hour or a fixed price',
    fields: [
      {
        name: 'pricing_model',
        label: 'How do you charge?',
        type: 'radio',
        options: [
          { value: 'hourly', label: 'Hourly rate', description: 'You bill for your time' },
          {
            value: 'fixed',
            label: 'Fixed price',
            description: 'One price for the whole service',
          },
        ],
        // Switching modes resets the price inputs so a value entered under the
        // other mode never rides along invisibly into the submit.
        clearOnChange: ['hourly_rate', 'fixed_price'],
        colSpan: 2,
      },
      {
        name: 'hourly_rate',
        label: 'Hourly Rate',
        type: 'currency',
        placeholder: '50.00',
        min: 1,
        hint: 'Your rate per hour. Enter in your preferred currency.',
        showWhen: { field: 'pricing_model', value: 'hourly' },
      },
      {
        name: 'fixed_price',
        label: 'Fixed Price',
        type: 'currency',
        placeholder: '500.00',
        min: 1,
        hint: 'Fixed project price. Enter in your preferred currency.',
        showWhen: { field: 'pricing_model', value: 'fixed' },
      },
      {
        name: 'duration_minutes',
        label: 'Typical Duration (minutes)',
        type: 'number',
        placeholder: 'e.g., 60',
        min: 1,
        hint: 'How long does a typical session last?',
        colSpan: 2,
      },
    ],
  },
  // Right after the price: what it costs and where the money goes are one
  // decision. At the end of the form it sat under "Profile Visibility" and
  // read as part of it.
  WALLET_FIELD_GROUP,
  {
    id: 'location',
    title: 'Location & Availability',
    description: 'Where can you deliver your service?',
    fields: [
      {
        name: 'service_location_type',
        label: 'Service Location',
        type: 'select',
        options: SERVICE_LOCATION_TYPES,
        colSpan: 2,
      },
      {
        name: 'service_area',
        label: 'Service Area',
        type: 'text',
        placeholder: 'e.g., Zurich, Switzerland',
        hint: 'Where can you provide on-site services?',
        showWhen: {
          field: 'service_location_type',
          value: ['onsite', 'both'],
        },
        colSpan: 2,
      },
      {
        name: 'availability_schedule',
        label: 'Weekly availability',
        type: 'availability',
        hint: 'When are you available? Shown to people before they book.',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    description: 'Control where this service appears',
    fields: [
      {
        name: 'show_on_profile',
        label: 'Show on Public Profile',
        type: 'checkbox',
        hint: 'When enabled, this service will appear on your public profile page',
        colSpan: 2,
      },
    ],
  },
];

// ==================== DEFAULT VALUES ====================

const defaultValues: UserServiceFormData = {
  title: '',
  description: '',
  category: '',
  pricing_model: 'hourly',
  hourly_rate: null,
  fixed_price: null,
  currency: undefined, // Will be set from user's profile preference in EntityForm
  duration_minutes: null,
  service_location_type: 'remote',
  service_area: '',
  images: [],
  portfolio_links: [],
  show_on_profile: true,
  status: ENTITY_STATUS.DRAFT,
};

// ==================== EXPORT CONFIG ====================

export const serviceConfig = createEntityConfig<UserServiceFormData>({
  entityType: 'service',
  name: 'Service',
  namePlural: 'Services',
  icon: Briefcase,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['service'].basePath,
  successUrl: ENTITY_REGISTRY['service'].basePath,
  pageTitle: 'Create Service',
  pageDescription: 'Offer your expertise to the community',
  formTitle: 'Service Details',
  formDescription:
    'Fill in the information for your new service offering. You can always edit these details later.',
  fieldGroups,
  validationSchema: userServiceSchema,
  defaultValues,
  // Edit mode / templates: infer the pricing toggle from which price is set,
  // so a fixed-price service opens with the fixed field visible.
  deriveInitialValues: data => ({
    pricing_model: data.fixed_price && !data.hourly_rate ? 'fixed' : 'hourly',
  }),
  guidanceContent: serviceGuidanceContent,
  defaultGuidance: serviceDefaultGuidance,
  templates: SERVICE_TEMPLATES as unknown as ServiceTemplate[],
});
