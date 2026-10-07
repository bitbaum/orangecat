/**
 * CIRCLE ENTITY CONFIGURATION (FORM)
 *
 * Form structure for creating a circle — a lightweight community (no treasury or
 * governance, unlike a group).
 */

import { CircleDashed } from 'lucide-react';
import { circleSchema, type CircleFormData } from '@/lib/validation';
import type { FieldGroup } from '@/components/create/types';
import { createEntityConfig } from './base-config-factory';
import { WALLET_FIELD_GROUP } from './wallet-field-group';

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Name your circle and describe what it’s about',
    fields: [
      {
        name: 'title',
        label: 'Circle Name',
        type: 'text',
        placeholder: 'e.g., Bitcoin Builders Berlin',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'What is this circle about? Who is it for?',
        rows: 5,
        colSpan: 2,
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Categorize your circle and choose who can see it',
    fields: [
      {
        name: 'category',
        label: 'Topic / Category',
        type: 'text',
        placeholder: 'e.g., Bitcoin, Art, Local',
        colSpan: 1,
      },
      {
        name: 'visibility',
        label: 'Visibility',
        type: 'select',
        required: true,
        options: [
          { value: 'public', label: 'Public' },
          { value: 'unlisted', label: 'Unlisted' },
          { value: 'private', label: 'Private' },
        ],
        colSpan: 1,
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'tags',
        placeholder: 'Add tags, separated by commas',
        colSpan: 2,
      },
    ],
  },
  // Receiving wallet — circles are registry-supportable; without the selector
  // there was no way to route support to one (same gap as research/wishlist).
  WALLET_FIELD_GROUP,
];

export const circleConfig = createEntityConfig<CircleFormData>({
  entityType: 'circle',
  name: 'Circle',
  namePlural: 'Circles',
  icon: CircleDashed,
  colorTheme: 'tiffany',
  pageTitle: 'Start a Circle',
  pageDescription: 'Create a lightweight community for people who share an interest.',
  formTitle: 'Circle Details',
  formDescription: 'Tell people what your circle is about',
  fieldGroups,
  validationSchema: circleSchema,
  defaultValues: {
    title: '',
    description: '',
    category: '',
    visibility: 'public',
    tags: [],
    status: 'active',
  },
  guidanceContent: {},
  defaultGuidance: {
    title: 'Build your community',
    description:
      'Circles are lightweight communities — no treasury or governance, just people who share an interest.',
    features: [
      { icon: '🔵', text: 'Gather people around a shared interest' },
      { icon: '🌍', text: 'Public, unlisted, or private' },
      { icon: '🏷️', text: 'Tag and categorize so others can discover it' },
    ],
  },
  successMessage: 'Circle created.',
});
