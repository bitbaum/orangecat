/**
 * COMPANION ENTITY CONFIGURATION (entity type `ai_assistant`)
 *
 * A companion is a being with its own voice and a memory of whoever talks to
 * it. The form is character-first: who they are, how they speak, then who
 * may talk to them. Money comes last and only matters once they are public.
 *
 * Created: 2025-12-25
 * Last Modified: 2026-09-15
 */

import { Bot } from 'lucide-react';
import { ENTITY_STATUS } from '@/config/database-constants';
import { aiAssistantSchema, type AIAssistantFormData } from '@/lib/validation';
import type { FieldGroup } from '@/components/create/types';
import { aiAssistantGuidanceContent, aiAssistantDefaultGuidance } from '@/lib/entity-guidance';
import { AI_ASSISTANT_TEMPLATES, type AIAssistantTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WalletSelectorField } from '@/components/create/wallet-selector';
import { AI_COMPUTE_PROVIDER_TYPES } from '@/config/ai-assistants';
import { getAvailableModels } from '@/config/ai-models';

// ==================== CONSTANTS ====================

const AI_CATEGORIES = [
  'Companion',
  'Writing & Content',
  'Code & Development',
  'Customer Support',
  'Education & Tutoring',
  'Business & Consulting',
  'Creative & Design',
  'Research & Analysis',
  'Entertainment',
  'Language & Translation',
  'Health & Wellness',
  'Legal & Finance',
  'Personal Assistant',
  'Other',
];

// Options derive from the model registry (SSOT) so this dropdown can never
// drift from what the platform actually serves. 'any' and 'local' are routing
// sentinels, not models.
const MODEL_PREFERENCES = [
  { value: 'any', label: 'Any - Let the system choose' },
  ...getAvailableModels().map(m => ({ value: m.id, label: m.name })),
  { value: 'local', label: 'Local Model' },
];

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Who they are',
    description: 'A name, and one paragraph anyone could read',
    fields: [
      {
        name: 'title',
        label: 'Name',
        type: 'text',
        placeholder: 'e.g., Mira, The Night Editor, Uncle Bo',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'In one paragraph',
        type: 'textarea',
        placeholder: 'Who they are, what they care about, what it is like to talk to them.',
        rows: 3,
        colSpan: 2,
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: AI_CATEGORIES.map(cat => ({ value: cat, label: cat })),
        colSpan: 1,
      },
    ],
  },
  {
    id: 'personality',
    title: 'How they think and speak',
    description:
      'The definition. This is the whole of who they are: it travels with every clone, and it is what an embodied version would run.',
    fields: [
      {
        name: 'system_prompt',
        label: 'Definition',
        type: 'textarea',
        placeholder:
          'You are Mira. You sit with a problem until it moves. You ask one question at a time, never flatter, and say the hard thing plainly and once...',
        rows: 10,
        required: true,
        colSpan: 2,
        hint: 'Write to them, in the second person: who they are, how they speak, what they care about, what they refuse to do.',
      },
      {
        name: 'welcome_message',
        label: 'Opening line',
        type: 'textarea',
        placeholder: "Take your time. What's actually the problem?",
        rows: 2,
        colSpan: 2,
        hint: 'The first thing they say when a conversation starts.',
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Who can talk to them',
    description: 'A companion starts private. Publishing is a choice, not a default.',
    fields: [
      {
        name: 'is_public',
        label: 'List publicly',
        type: 'checkbox',
        hint: 'Private: only you can talk to them. Public: anyone can, and pays you per message if you set a price.',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'model',
    title: 'Model (advanced)',
    description: 'Which model runs them, and how freely',
    fields: [
      {
        name: 'model_preference',
        label: 'Preferred Model',
        type: 'select',
        options: MODEL_PREFERENCES,
        colSpan: 1,
        hint: 'Select "Any" to let the system optimize for cost/speed',
      },
      {
        name: 'temperature',
        label: 'Temperature',
        type: 'number',
        placeholder: '0.7',
        min: 0,
        max: 2,
        step: 0.1,
        colSpan: 1,
        hint: '0 = deterministic, 2 = creative. Default: 0.7',
      },
      {
        name: 'max_tokens_per_response',
        label: 'Max Tokens per Response',
        type: 'number',
        placeholder: '1000',
        min: 100,
        max: 32000,
        colSpan: 1,
        hint: 'Limit response length to control costs',
      },
      {
        name: 'compute_provider_type',
        label: 'Compute Provider',
        type: 'select',
        options: [...AI_COMPUTE_PROVIDER_TYPES],
        colSpan: 1,
        hint: 'Where your AI runs',
      },
    ],
  },
  {
    id: 'payment',
    title: 'Payments (public companions)',
    description:
      'Wallet for receiving payments. Per-message pricing is charged from the chatter’s Cat Credits — you keep all of it as spendable credits.',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
];

// ==================== DEFAULT VALUES ====================

const defaultValues: AIAssistantFormData = {
  title: '',
  description: '',
  category: '',
  tags: [],
  avatar_url: '',
  system_prompt: '',
  welcome_message: '',
  personality_traits: [],
  model_preference: 'any',
  max_tokens_per_response: 1000,
  temperature: 0.7,
  compute_provider_type: 'api',
  compute_provider_id: null,
  api_provider: '',
  pricing_model: 'free',
  price_per_message: 0,
  price_per_1k_tokens: 0,
  subscription_price: 0,
  free_messages_per_day: 0,
  is_public: false,
  is_featured: false,
  status: ENTITY_STATUS.ACTIVE,
  lightning_address: '',
  bitcoin_address: '',
};

// ==================== EXPORT CONFIG ====================

export const aiAssistantConfig = createEntityConfig<AIAssistantFormData>({
  entityType: 'ai_assistant',
  name: 'Companion',
  namePlural: 'Companions',
  icon: Bot,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['ai_assistant'].basePath,
  successUrl: `${ENTITY_REGISTRY['ai_assistant'].basePath}/[id]`,
  pageTitle: 'Create a companion',
  pageDescription: 'A being with its own voice that remembers whoever talks to it.',
  formTitle: 'Your companion',
  formDescription:
    'Write who they are. The definition is the whole of them: it is what a clone copies, and what an embodied version would run.',
  fieldGroups,
  validationSchema: aiAssistantSchema,
  defaultValues,
  guidanceContent: aiAssistantGuidanceContent,
  defaultGuidance: aiAssistantDefaultGuidance,
  templates: AI_ASSISTANT_TEMPLATES as unknown as AIAssistantTemplate[],
  infoBanner: {
    title: 'Yours first, then anyone’s',
    content:
      'A companion starts private: only you can talk to it, and it remembers you. Publish it and anyone can talk to it, paying you per message if you set a price. Clones copy the definition, never the memories.',
    variant: 'info',
  },
});
