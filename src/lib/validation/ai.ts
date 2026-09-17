import { z } from 'zod';
import {
  AI_COMPUTE_PROVIDER_TYPES,
  AI_PRICING_MODELS,
  AI_ASSISTANT_STATUSES,
} from '@/config/ai-assistants';
import { STATUS } from '@/config/database-constants';
import { lightningAddressSchema, optionalText, optionalUrl } from './base';

/** Maximum character length for AI chat messages and system prompts */
export const AI_MESSAGE_MAX_CHARS = 10_000;

/**
 * AI Assistant Schema
 *
 * Comprehensive schema for AI assistants that creators build and monetize.
 * Supports multiple compute providers (API, self-hosted, community)
 * and flexible pricing models (per-message, per-token, subscription).
 */
export const aiAssistantSchema = z.object({
  // Basic Info
  title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
  description: optionalText(1000),
  category: optionalText(50),
  tags: z.array(z.string()).optional().default([]),
  avatar_url: optionalUrl(),

  // AI Configuration (the "software")
  system_prompt: z
    .string()
    .min(10, 'System prompt must be at least 10 characters')
    .max(AI_MESSAGE_MAX_CHARS, `System prompt must be at most ${AI_MESSAGE_MAX_CHARS} characters`),
  welcome_message: optionalText(500),
  personality_traits: z.array(z.string()).optional().default([]),
  // `knowledge_base_urls` was removed here on 2026-08-26. It was accepted by
  // this schema, mapped by the API and stored — and read by nothing. The chat's
  // own SELECT (services/ai/sendMessage-internals.ts) never asked for it, no
  // code fetches those URLs, and no form ever offered an input for them, so no
  // creator could set it from the product at all. Production held 6 assistants,
  // every one of them empty or null.
  //
  // Removed rather than rendered: showing "answers from these sources" would
  // have been a claim the system does not honour, which is worse than the
  // silence. The column is deliberately left in place — dropping it would be an
  // irreversible migration to delete nothing, and it is where retrieval would
  // store its sources if that feature is ever built.

  // Model Preferences
  model_preference: z.string().max(50).default('any'),
  max_tokens_per_response: z.number().int().positive().max(32000).default(1000),
  temperature: z.number().min(0).max(2).default(0.7),

  // Compute Configuration
  compute_provider_type: z
    .enum(AI_COMPUTE_PROVIDER_TYPES.map(t => t.value) as [string, ...string[]])
    .default('api'),
  compute_provider_id: z.string().guid().optional().nullable(),
  api_provider: optionalText(50),

  // Pricing
  pricing_model: z
    .enum(AI_PRICING_MODELS.map(t => t.value) as [string, ...string[]])
    .default('per_message'),
  price_per_message: z.number().min(0).default(0),
  price_per_1k_tokens: z.number().min(0).default(0),
  subscription_price: z.number().min(0).default(0),
  free_messages_per_day: z.number().int().min(0).default(0),

  // Visibility & Status
  status: z
    .enum(AI_ASSISTANT_STATUSES.map(t => t.value) as [string, ...string[]])
    .default(STATUS.AI_ASSISTANTS.DRAFT),
  is_public: z.boolean().default(false),
  is_featured: z.boolean().default(false),

  // Bitcoin Payment Info
  lightning_address: lightningAddressSchema,
  bitcoin_address: optionalText(),
});

// Types
export type AIAssistantFormData = z.infer<typeof aiAssistantSchema>;
