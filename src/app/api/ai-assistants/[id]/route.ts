/**
 * AI Assistant CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * AI Assistants are autonomous AI services that creators build and monetize.
 * They support multiple compute providers (API, self-hosted, community)
 * and flexible pricing models (per-message, per-token, subscription).
 */

import { aiAssistantSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// Build update payload from validated AI assistant data
const buildAIAssistantUpdatePayload = createUpdatePayloadBuilder([
  // Basic Info
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'category', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.arrayField('tags', []),
  commonFieldMappings.urlField('avatar_url'),
  // AI Configuration
  { from: 'system_prompt' },
  { from: 'welcome_message', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.arrayField('personality_traits', []),
  // knowledge_base_urls intentionally not mapped — see lib/validation/ai.ts.
  // Model Preferences
  { from: 'model_preference', default: 'any' },
  { from: 'max_tokens_per_response', default: 1000 },
  { from: 'temperature', default: 0.7 },
  // Compute Configuration
  { from: 'compute_provider_type', default: 'api' },
  commonFieldMappings.uuidField('compute_provider_id'), // UUID field - normalize empty strings
  { from: 'api_provider', transform: entityTransforms.emptyStringToNull },
  // Pricing
  { from: 'pricing_model', default: 'per_message' },
  { from: 'price_per_message', default: 0 },
  { from: 'price_per_1k_tokens', default: 0 },
  { from: 'subscription_price', default: 0 },
  { from: 'free_messages_per_day', default: 0 },
  // Visibility & Status
  // No default — see products/[id] note: a status default unpublishes on partial PUT.
  { from: 'status' },
  // Same rule for visibility: a title-only PUT must not turn a public companion private.
  { from: 'is_public' },
  { from: 'is_featured', default: false },
  // Bitcoin Payment Info
  { from: 'lightning_address', transform: entityTransforms.emptyStringToNull },
  { from: 'bitcoin_address', transform: entityTransforms.emptyStringToNull },
]);

// Create handlers using generic factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'ai_assistant',
  schema: aiAssistantSchema,
  buildUpdatePayload: buildAIAssistantUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
  requireActiveStatus: false, // Allow viewing draft assistants by owner
});

export { GET, PUT, DELETE };
