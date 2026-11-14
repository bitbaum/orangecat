/**
 * Service CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * Before refactoring: 189 lines
 * After refactoring: ~45 lines (76% reduction)
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { userServiceSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// Build update payload from validated service data
const buildServiceUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'category' },
  { from: 'hourly_rate' },
  { from: 'fixed_price' },
  // Currency: only include if explicitly provided (don't override existing value)
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
  { from: 'duration_minutes' },
  { from: 'availability_schedule' },
  { from: 'service_location_type' },
  { from: 'service_area', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.arrayField('images', []),
  ...coverFieldMapping('service'),
  commonFieldMappings.arrayField('portfolio_links', []),
  { from: 'show_on_profile' },
  // Status omitted intentionally — UPDATE that drops the field should keep
  // the existing row's status. Previous default:'draft' did the opposite of
  // its own comment: it silently unpublished active services on partial PUT.
  // Status transitions go through /api/entities/service/{id}/status.
  { from: 'status' },
]);

// Create handlers using generic factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'service',
  schema: userServiceSchema,
  buildUpdatePayload: buildServiceUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
});

export { GET, PUT, DELETE };
