/**
 * Asset CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * Note: Assets use actor_id for ownership via useActorOwnership pattern
 *
 * Before refactoring: 214 lines
 * After refactoring: ~45 lines (79% reduction)
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { assetSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// Build update payload from validated asset data
const buildAssetUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'type' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'location', transform: entityTransforms.emptyStringToNull },
  { from: 'estimated_value' },
  // Currency: only include if explicitly provided (don't override existing value)
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
  commonFieldMappings.arrayField('documents', []), // Normalize null to empty array
  ...coverFieldMapping('asset'),
  // Sale / rental / deposit config — collected by the form and backed by real
  // `assets` columns, but previously dropped on both create and update (the form
  // silently didn't work). Now persisted. (Caught by the update-builder guard.)
  { from: 'is_for_sale' },
  { from: 'sale_price_btc' },
  { from: 'is_for_rent' },
  { from: 'rental_price_btc' },
  { from: 'rental_period_type' },
  { from: 'min_rental_period' },
  { from: 'max_rental_period' },
  { from: 'requires_deposit' },
  { from: 'deposit_amount_btc' },
  { from: 'show_on_profile' },
]);

function buildListedAssetUpdatePayload(data: Record<string, unknown>) {
  const payload = buildAssetUpdatePayload(data);
  if (payload.is_for_sale !== undefined || payload.is_for_rent !== undefined) {
    const listed = Boolean(payload.is_for_sale || payload.is_for_rent);
    payload.status = listed ? 'active' : 'draft';
    payload.public_visibility = listed;
  }
  return payload;
}

// Create handlers using generic factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'asset',
  schema: assetSchema,
  buildUpdatePayload: buildListedAssetUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
  requireAuthForGet: true, // Assets require auth to view
  requireActiveStatus: false, // Assets don't filter by status='active'
});

export { GET, PUT, DELETE };
