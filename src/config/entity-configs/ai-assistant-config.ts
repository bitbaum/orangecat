/**
 * AI ASSISTANT ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for AI assistant creation.
 * AI Assistants are autonomous AI services that creators build and monetize.
 *
 * Created: 2025-12-25
 * Last Modified: 2025-12-25
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
    title: 'Basic Information',
    description: 'Give your AI assistant a name and description',
    fields: [
      {
        name: 'title',
        label: 'Assistant Name',
        type: 'text',
        placeholder: 'e.g., Bitcoin Tax Advisor, Code Reviewer, Writing Coach',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: "Describe what your AI assistant does, who it's for, and how it can help...",
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
    title: 'AI Configuration',
    description: 'Define how your AI assistant thinks and communicates',
    fields: [
      {
        name: 'system_prompt',
        label: 'System Prompt',
        type: 'textarea',
        placeholder:
          'You are a helpful Bitcoin tax advisor. You help users understand tax implications of their Bitcoin transactions. Be concise, professional, and always recommend consulting a qualified tax professional for specific advice...',
        rows: 8,
        required: true,
        colSpan: 2,
        hint: "This is the core instruction that defines your AI's behavior. Think of it as your AI's \"brain\" - this is the software you're creating.",
      },
      {
        name: 'welcome_message',
        label: 'Welcome Message',
        type: 'textarea',
        placeholder:
          "Hello! I'm your Bitcoin Tax Advisor. I can help you understand the tax implications of your Bitcoin transactions. What would you like to know?",
        rows: 2,
        colSpan: 2,
        hint: 'The first message users see when starting a conversation',
      },
    ],
  },
  {
    id: 'model',
    title: 'Model Settings',
    description: 'Configure AI model preferences and behavior',
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
    title: 'Bitcoin & Payments',
    description:
      'Wallet for receiving donations. Per-message pricing is charged from the chatter’s Cat Credits — you keep all of it as spendable credits.',
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
  is_public: true,
  is_featured: false,
  status: ENTITY_STATUS.DRAFT,
  lightning_address: '',
  bitcoin_address: '',
};

// ==================== EXPORT CONFIG ====================

export const aiAssistantConfig = createEntityConfig<AIAssistantFormData>({
  entityType: 'ai_assistant',
  name: 'AI Assistant',
  namePlural: 'AI Assistants',
  icon: Bot,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['ai_assistant'].basePath,
  successUrl: `${ENTITY_REGISTRY['ai_assistant'].basePath}/[id]`,
  pageTitle: 'Create AI Assistant',
  pageDescription: 'Build an autonomous AI service that earns Bitcoin',
  formTitle: 'AI Assistant Details',
  formDescription:
    'Define your AI assistant\'s personality and capabilities. Your system prompt is the "software" that makes your AI unique.',
  fieldGroups,
  validationSchema: aiAssistantSchema,
  defaultValues,
  guidanceContent: aiAssistantGuidanceContent,
  defaultGuidance: aiAssistantDefaultGuidance,
  templates: AI_ASSISTANT_TEMPLATES as unknown as AIAssistantTemplate[],
  infoBanner: {
    title: 'Portable AI Software',
    content:
      'Your AI assistant is portable software - the system prompt you create here can work with any AI provider. Focus on crafting valuable instructions, and your AI can earn Bitcoin 24/7.',
    variant: 'info',
  },
});
