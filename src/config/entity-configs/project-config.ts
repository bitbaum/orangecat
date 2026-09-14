/**
 * PROJECT ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for project creation.
 *
 * Created: 2025-12-06
 * Last Modified: 2025-12-06
 * Last Modified Summary: Initial project configuration
 */

import { Rocket } from 'lucide-react';
import { projectSchema, type ProjectData } from '@/lib/validation';
import {
  projectGuidanceContent,
  projectDefaultGuidance,
} from '@/lib/entity-guidance/project-guidance';
import type { FieldGroup, WizardConfig } from '@/components/create/types';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WalletSelectorField } from '@/components/create/wallet-selector';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Essential details about your project',
    fields: [
      {
        name: 'title',
        label: 'Project Title',
        type: 'text',
        placeholder: 'e.g., Build a Community Garden',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Project Description',
        type: 'textarea',
        placeholder: 'Describe your project in detail...',
        rows: 6,
        required: true,
        colSpan: 2,
        hint: "Be specific about what you're building, who it helps, and why it matters.",
      },
      {
        name: 'vision',
        label: 'Vision',
        type: 'textarea',
        placeholder:
          'e.g., Every local grower in the valley sells direct, with no middleman taking a cut.',
        rows: 3,
        colSpan: 2,
        hint: 'Where this ends up if it succeeds. The description says what it is; this says what it is for.',
      },
      {
        name: 'work_status',
        label: 'Current Status',
        type: 'textarea',
        placeholder: 'e.g., Wiring the payment flow — beta opens next week.',
        rows: 2,
        colSpan: 2,
        hint: 'Where the work stands right now. The description says what it is; this says what is happening.',
      },
    ],
  },
  {
    id: 'funding',
    title: 'Funding Goals',
    description: 'Set your funding target and Bitcoin payment details',
    fields: [
      {
        name: 'goal_amount',
        label: 'Funding Goal',
        type: 'currency',
        isGoal: true,
        placeholder: '10000',
        hint: 'Optional: Set a funding target for your project. Currency selector is included in this field.',
      },
      {
        name: 'funding_purpose',
        label: 'Funding Purpose',
        type: 'textarea',
        placeholder: 'How will the funds be used?',
        rows: 3,
        hint: 'Explain how funding will be spent and what impact it will create.',
      },
    ],
  },
  {
    id: 'bitcoin',
    title: 'Bitcoin & Payments',
    description: 'Select a wallet or enter an address',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
  {
    id: 'details',
    title: 'Project Details',
    description: 'Additional information about your project',
    fields: [
      {
        name: 'website_url',
        label: 'Project Website',
        type: 'url',
        placeholder: 'https://your-project.com',
        hint: 'Optional: Link to your project website or landing page',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'text',
        placeholder: 'e.g., Technology, Environment, Education',
        hint: 'Main category that best describes your project',
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'tags',
        placeholder: 'Add relevant tags...',
        hint: 'Add tags to help people discover your project',
      },
      {
        name: 'start_date',
        label: 'Start Date',
        type: 'date',
        hint: 'Optional: When do you plan to start the project?',
      },
      {
        name: 'target_completion',
        label: 'Target Completion',
        type: 'date',
        hint: 'Optional: When do you expect to complete the project?',
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    description: 'Control where this project appears',
    fields: [
      {
        name: 'show_on_profile',
        label: 'Show on Public Profile',
        type: 'checkbox',
        hint: 'When enabled, this project will appear on your public profile page',
        colSpan: 2,
      },
    ],
  },
];

// ==================== WIZARD CONFIGURATION ====================

const wizardConfig: WizardConfig = {
  enabled: true,
  includeTemplateStep: true,
  steps: [
    {
      id: 'basic',
      title: 'Basic Info',
      description: 'Tell us about your project',
      optional: false,
      fields: ['title', 'description', 'vision', 'work_status'],
    },
    {
      id: 'funding',
      title: 'Funding',
      description: 'Set your funding goals and Bitcoin payment details',
      optional: false,
      fields: ['goal_amount', 'funding_purpose', 'bitcoin_address', 'lightning_address'],
    },
    {
      id: 'additional',
      title: 'Additional',
      description: 'Add more details to help people discover your project',
      optional: true,
      fields: [
        'website_url',
        'category',
        'tags',
        'start_date',
        'target_completion',
        'show_on_profile',
      ],
    },
  ],
};

// ==================== CONFIGURATION ====================

export const projectConfig = createEntityConfig<ProjectData>({
  entityType: 'project',
  name: 'Project',
  namePlural: 'Projects',
  icon: Rocket,
  colorTheme: 'orange',
  backUrl: ENTITY_REGISTRY['project'].basePath,
  successUrl: `${ENTITY_REGISTRY['project'].publicBasePath}/[id]`,
  pageTitle: 'Create Project',
  pageDescription: 'Create a project and start receiving funding from your community.',
  formTitle: 'Project Information',
  formDescription: 'Tell your story and set funding goals',
  fieldGroups,
  validationSchema: projectSchema,
  defaultValues: {
    title: '',
    description: '',
    goal_amount: undefined,
    currency: undefined, // Will be set from user's profile preference in EntityForm
    funding_purpose: '',
    bitcoin_address: '',
    lightning_address: '',
    website_url: '',
    category: '',
    tags: [],
    start_date: '',
    target_completion: '',
    // Checked by default — matches the DB show_on_profile default and other configs.
    show_on_profile: true,
  },
  guidanceContent: projectGuidanceContent,
  defaultGuidance: projectDefaultGuidance,
  templates: PROJECT_TEMPLATES as unknown as ProjectTemplate[],
  successMessage: 'Project created successfully!',
  successRedirectDelay: 2000,
  wizardConfig,
});
