/**
 * Product CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * Before refactoring: 189 lines
 * After refactoring: ~45 lines (76% reduction)
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { userProductSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// Build update payload from validated product data
const buildProductUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'price' },
  // Currency: only include if explicitly provided (don't override existing value)
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
  { from: 'product_type', default: 'physical' },
  commonFieldMappings.arrayField('images', []),
  ...coverFieldMapping('product'),
  { from: 'inventory_count', default: -1 },
  { from: 'fulfillment_type', default: 'manual' },
  { from: 'category', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.arrayField('tags', []),
  // No default: a partial PUT that omits `status` must keep the row's existing
  // status. A `default: 'draft'` silently unpublished active entities on edit
  // (same bug the events builder already fixed). Status transitions go through
  // the dedicated /api/entities/[type]/[id]/status endpoint, not this builder.
  { from: 'status' },
  { from: 'is_featured', default: false },
  { from: 'show_on_profile' },
]);

// Create handlers using generic factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'product',
  schema: userProductSchema,
  buildUpdatePayload: buildProductUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
});

export { GET, PUT, DELETE };
