/**
 * GROUP ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for group creation.
 * Follows the modular EntityConfig pattern for consistency.
 *
 * Created: 2025-12-30
 * Last Modified: 2025-12-30
 * Last Modified Summary: Initial group config following EntityConfig pattern
 */

import { Users } from 'lucide-react';
import { createGroupSchema, type CreateGroupSchemaType } from '@/services/groups/validation';
import { groupGuidanceContent, groupDefaultGuidance } from '@/lib/entity-guidance/group-guidance';
import type { FieldGroup } from '@/components/create/types';
import { GROUP_TEMPLATES } from '@/components/create/templates/group-templates';
import { createEntityConfig } from './base-config-factory';
import { getGroupLabelsArray } from '@/config/group-labels';
import { GOVERNANCE_PRESETS } from '@/config/governance-presets';
import { WalletSelectorField } from '@/components/create/wallet-selector';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'label',
    title: 'Group Type',
    description: "Labels influence defaults but don't restrict capabilities",
    fields: [
      {
        name: 'label',
        label: 'Group Label *',
        type: 'select',
        required: true,
        options: getGroupLabelsArray().map(label => ({
          value: label.key,
          label: `${label.name} - ${label.description}`,
        })),
        colSpan: 2,
      },
    ],
  },
  {
    id: 'basic',
    title: 'Basic Information',
    description: "Set up your group's foundation",
    fields: [
      {
        name: 'name',
        label: 'Group Name *',
        type: 'text',
        placeholder: 'e.g., Bitcoin Investment Club, Ossetia Network State',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: "Describe your group's purpose and goals...",
        rows: 4,
        colSpan: 2,
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure how your group operates',
    fields: [
      {
        name: 'governance_preset',
        label: 'Governance Model',
        type: 'select',
        options: Object.entries(GOVERNANCE_PRESETS).map(([key, preset]) => ({
          value: key,
          label: `${preset.name} - ${preset.description}`,
        })),
        colSpan: 2,
      },
      {
        name: 'visibility',
        label: 'Visibility',
        type: 'select',
        options: [
          { value: 'public', label: 'Public - Anyone can see content' },
          { value: 'members_only', label: 'Members Only - Only members can see content' },
          { value: 'private', label: 'Private - Hidden from discovery' },
        ],
        colSpan: 2,
      },
      {
        name: 'is_public',
        label: 'Listed in Directory',
        type: 'checkbox',
        hint: 'Show this group in public group listings',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'bitcoin',
    title: 'Pay into',
    description: 'Where money for this group should land',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
];

// ==================== DEFAULT VALUES ====================

const defaultValues: CreateGroupSchemaType = {
  name: '',
  description: '',
  label: 'circle',
  governance_preset: 'consensus',
  is_public: false,
  visibility: 'members_only',
  bitcoin_address: null,
  lightning_address: null,
  tags: [],
  avatar_url: null,
  banner_url: null,
  voting_threshold: null,
};

// ==================== EXPORT CONFIG ====================

export const groupConfig = createEntityConfig<CreateGroupSchemaType>({
  entityType: 'group',
  name: 'Group',
  namePlural: 'Groups',
  icon: Users,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['group'].basePath,
  successUrl: `${ENTITY_REGISTRY['group'].publicBasePath}/[slug]`,
  pageTitle: 'Create Group',
  pageDescription: 'Start a new group, circle, or organization',
  formTitle: 'Create New Group',
  formDescription:
    "Choose a label and configure your group. Labels influence defaults but don't restrict capabilities.",
  fieldGroups,
  validationSchema: createGroupSchema,
  defaultValues,
  guidanceContent: groupGuidanceContent,
  defaultGuidance: groupDefaultGuidance,
  templates: GROUP_TEMPLATES,
  infoBanner: {
    title: 'Labels are templates, not restrictions',
    content:
      'Labels help set smart defaults, but you can enable any features regardless of label. A "Family" can enable voting, and a "DAO" can disable treasury.',
    variant: 'info',
  },
});
