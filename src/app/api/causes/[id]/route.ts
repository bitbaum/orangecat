/**
 * Cause CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * Refactored: 2026-01-04 to use generic CRUD handlers for consistency
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { userCauseSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// Build update payload from validated cause data
const buildCauseUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'cause_category' },
  { from: 'goal_amount' },
  // Currency: only include if explicitly provided (don't override existing value)
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
  { from: 'bitcoin_address', transform: entityTransforms.emptyStringToNull },
  { from: 'lightning_address', transform: entityTransforms.emptyStringToNull },
  { from: 'distribution_rules' },
  commonFieldMappings.arrayField('beneficiaries', []),
  ...coverFieldMapping('cause'),
  // No default — see products/[id] note: a status default unpublishes on partial PUT.
  { from: 'status' },
  { from: 'show_on_profile' },
]);

// Create handlers using generic factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'cause',
  schema: userCauseSchema,
  buildUpdatePayload: buildCauseUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
});

export { GET, PUT, DELETE };
