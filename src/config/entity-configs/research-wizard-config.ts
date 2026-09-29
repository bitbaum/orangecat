/**
 * Research Wizard Configuration
 *
 * Wizard-compatible config for the unified EntityCreationWizard.
 * Maps existing research constants to the EntityConfig interface.
 *
 * Created: 2026-02-24
 */

import { Microscope } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { z } from 'zod';
import {
  RESEARCH_FIELDS,
  METHODOLOGIES,
  TIMELINES,
  FUNDING_MODELS,
  PROGRESS_FREQUENCIES,
  TRANSPARENCY_LEVELS,
} from '@/config/research';
import { RESEARCH_LICENSES } from '@/config/open-science';
import { openScienceFields } from '@/domain/research/openScience';
import {
  researchGuidanceContent,
  researchDefaultGuidance,
} from '@/lib/entity-guidance/research-guidance';
import type { FieldGroup, EntityTemplate } from '@/components/create/types';
import { createEntityConfig } from './base-config-factory';
import { WALLET_FIELD_GROUP } from './wallet-field-group';

// ==================== FORM DATA TYPE ====================

export type ResearchWizardFormData = {
  title: string;
  description: string;
  field: string;
  methodology: string;
  expected_outcome: string;
  timeline: string;
  funding_goal_btc: number;
  funding_model: string;
  lead_researcher: string;
  open_collaboration: boolean;
  progress_frequency: string;
  transparency_level: string;
  voting_enabled: boolean;
  is_public: boolean;
  license?: string | null;
  output_links?: string[];
  preregistration?: string | null;
  current_milestone?: string | null;
};

// ==================== VALIDATION SCHEMA ====================

const researchWizardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  field: z.string().min(1, 'Research field is required'),
  methodology: z.string().min(1, 'Methodology is required'),
  expected_outcome: z.string().min(1, 'Expected outcome is required').max(1000),
  timeline: z.string().min(1, 'Timeline is required'),
  funding_goal_btc: z.number().positive('Funding goal must be greater than 0'),
  funding_model: z.string().min(1, 'Funding model is required'),
  lead_researcher: z.string().min(1, 'Lead researcher is required'),
  open_collaboration: z.boolean().optional().default(true),
  progress_frequency: z.string().min(1, 'Progress frequency is required'),
  transparency_level: z.string().min(1, 'Transparency level is required'),
  voting_enabled: z.boolean().optional().default(true),
  is_public: z.boolean().optional().default(true),
  current_milestone: z.string().trim().max(300).nullable().optional(),
  ...openScienceFields,
});

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Research Information',
    description: 'Define your research question and approach',
    fields: [
      {
        name: 'title',
        label: 'Research Title',
        type: 'text',
        placeholder: 'The fundamental question your research addresses',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Research Description',
        type: 'textarea',
        placeholder: 'What understanding are you pursuing? What problem are you solving?',
        rows: 4,
        required: true,
        colSpan: 2,
      },
      {
        name: 'field',
        label: 'Research Field',
        type: 'select',
        required: true,
        options: [...RESEARCH_FIELDS],
        colSpan: 1,
      },
      {
        name: 'methodology',
        label: 'Research Methodology',
        type: 'select',
        required: true,
        options: [...METHODOLOGIES],
        colSpan: 1,
      },
      {
        name: 'expected_outcome',
        label: 'Expected Outcome',
        type: 'textarea',
        placeholder: 'What understanding or breakthrough do you hope to achieve?',
        rows: 3,
        required: true,
        colSpan: 2,
      },
      {
        name: 'timeline',
        label: 'Research Timeline',
        type: 'select',
        required: true,
        options: [...TIMELINES],
        colSpan: 2,
      },
    ],
  },
  {
    id: 'funding',
    title: 'Funding & Resources',
    description: 'How your research will be funded',
    fields: [
      {
        name: 'funding_goal_btc',
        label: 'Funding Goal (BTC)',
        type: 'number',
        placeholder: '0.5',
        required: true,
        min: 0,
        hint: 'Enter the total funding needed in BTC (e.g. 0.5 BTC).',
        colSpan: 1,
      },
      {
        name: 'funding_model',
        label: 'Funding Model',
        type: 'select',
        required: true,
        options: [...FUNDING_MODELS],
        colSpan: 1,
      },
    ],
  },
  // Receiving wallet — without this, funders had no way to pay a research
  // project (the only supportable entity type missing the selector).
  WALLET_FIELD_GROUP,
  {
    id: 'team',
    title: 'Research Team',
    description: 'Who will be working on this research',
    fields: [
      {
        name: 'lead_researcher',
        label: 'Lead Researcher',
        type: 'text',
        placeholder: 'A name or a pseudonym — real identity is never required',
        required: true,
        colSpan: 2,
      },
      {
        name: 'open_collaboration',
        label: 'Open to New Collaborators',
        type: 'checkbox',
        hint: 'Allow other researchers to join this project',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'open-science',
    title: 'Open Science',
    description: 'What your backers get back: the terms, the outputs, and the plan you commit to',
    fields: [
      {
        name: 'license',
        label: 'Licence for the outputs',
        type: 'select',
        options: RESEARCH_LICENSES.map(({ value, label }) => ({ value, label })),
        hint: 'An open licence lets anyone read, check and build on what you find.',
        colSpan: 2,
      },
      {
        name: 'output_links',
        label: 'Where the outputs live',
        type: 'tags',
        placeholder: 'https://github.com/…, ipfs://…, https://zenodo.org/records/…',
        hint: 'Preprints, datasets, code, protocols — separated by commas. ipfs:// and ar:// links are content-addressed, so what they point at cannot be swapped later.',
        colSpan: 2,
      },
      {
        name: 'preregistration',
        label: 'Pre-registration (optional)',
        type: 'textarea',
        placeholder:
          'Hypothesis, what you will measure, how you will analyse it, and what result would prove you wrong.',
        hint: 'Written before you see results. Saving it records a SHA-256 hash and a timestamp, and it can never be edited afterwards — that is what makes it worth trusting.',
        rows: 5,
        colSpan: 2,
      },
    ],
  },
  {
    id: 'transparency',
    title: 'Progress & Transparency',
    description: 'How you will share progress and involve the community',
    fields: [
      {
        name: 'progress_frequency',
        label: 'Progress Update Frequency',
        type: 'select',
        required: true,
        options: [...PROGRESS_FREQUENCIES],
        colSpan: 1,
      },
      {
        name: 'transparency_level',
        label: 'Transparency Level',
        type: 'select',
        required: true,
        options: [...TRANSPARENCY_LEVELS],
        colSpan: 1,
      },
      {
        name: 'current_milestone',
        label: 'Current milestone',
        type: 'text',
        placeholder: 'e.g. Season-one samples collected and analysed',
        hint: 'What is done now. Backers can vote in Solon on whether it was met before the next tranche is released.',
        colSpan: 2,
      },
      {
        name: 'voting_enabled',
        label: 'Enable Community Voting',
        type: 'checkbox',
        hint: 'Allow supporters to vote on research direction and priorities',
        colSpan: 2,
      },
      {
        name: 'is_public',
        label: 'Make Research Public',
        type: 'checkbox',
        hint: 'Make this research entity visible to everyone',
        colSpan: 2,
      },
    ],
  },
];

// ==================== DEFAULT VALUES ====================

const defaultValues: ResearchWizardFormData = {
  title: '',
  description: '',
  field: '',
  methodology: '',
  expected_outcome: '',
  timeline: '',
  funding_goal_btc: 0,
  funding_model: 'donation',
  lead_researcher: '',
  open_collaboration: true,
  progress_frequency: 'monthly',
  transparency_level: 'progress',
  voting_enabled: true,
  is_public: true,
  license: 'CC-BY-4.0',
  output_links: [],
  preregistration: '',
};

// ==================== TEMPLATES ====================

const RESEARCH_TEMPLATES: EntityTemplate<ResearchWizardFormData>[] = [
  {
    id: 'academic',
    icon: '🎓',
    name: 'Academic Research',
    tagline: 'Traditional research with peer review and publication goals',
    defaults: {
      methodology: 'empirical',
      funding_model: 'milestone',
      progress_frequency: 'monthly',
      transparency_level: 'full',
      voting_enabled: false,
      open_collaboration: false,
      is_public: true,
    },
  },
  {
    id: 'community-survey',
    icon: '📊',
    name: 'Community Survey',
    tagline: 'Gather data and insights from the community',
    defaults: {
      methodology: 'survey',
      funding_model: 'donation',
      timeline: 'short_term',
      progress_frequency: 'weekly',
      transparency_level: 'full',
      voting_enabled: true,
      open_collaboration: true,
      is_public: true,
    },
  },
  {
    id: 'open-source-rd',
    icon: '🔬',
    name: 'Open Source R&D',
    tagline: 'Collaborative research with open results and shared findings',
    defaults: {
      methodology: 'computational',
      funding_model: 'subscription',
      progress_frequency: 'biweekly',
      transparency_level: 'full',
      voting_enabled: true,
      open_collaboration: true,
      is_public: true,
    },
  },
];

// ==================== EXPORT CONFIG ====================

export const researchWizardConfig = createEntityConfig<ResearchWizardFormData>({
  entityType: 'research',
  name: 'Research',
  namePlural: 'Research',
  icon: Microscope,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['research'].basePath,
  successUrl: `${ENTITY_REGISTRY['research'].basePath}/[id]`,
  pageTitle: 'Create Research',
  pageDescription: 'Launch your independent research with decentralized funding',
  formTitle: 'Research Details',
  formDescription: 'Define your research question, methodology, and funding needs.',
  fieldGroups,
  validationSchema: researchWizardSchema,
  defaultValues,
  guidanceContent: researchGuidanceContent,
  defaultGuidance: researchDefaultGuidance,
  templates: RESEARCH_TEMPLATES,
  infoBanner: {
    title: 'Transparency Commitment',
    content:
      'By creating this research entity, you commit to providing regular progress updates and using all received funds for the stated research purpose.',
    variant: 'warning',
  },
});
