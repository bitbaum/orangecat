/**
 * Wishlist CRUD API Routes
 *
 * Adds detail/update/delete workflows for individual wishlists.
 * Uses generic entity CRUD handlers and registry metadata.
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { wishlistSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// UPDATE never re-applies defaults — that's CREATE's job. Earlier this
// builder hardcoded `visibility:'public'` and `is_active:true`, which
// silently flipped private/draft wishlists back to public+active on any
// partial PUT (form omits a field, partial REST update, etc.). Same bug
// class as the create-path privacy bug fixed in c9897f9a, on the edit
// path. Omitted fields now keep their existing DB value, which is what
// every other PUT route should also do.
const buildWishlistUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'type' },
  { from: 'visibility' },
  commonFieldMappings.dateField('event_date'),
  ...coverFieldMapping('wishlist'),
  { from: 'is_active' },
]);

const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'wishlist',
  schema: wishlistSchema,
  buildUpdatePayload: buildWishlistUpdatePayload,
  requireAuthForGet: true,
  requireActiveStatus: false,
  ownershipField: 'actor_id',
  useActorOwnership: true,
});

export { GET, PUT, DELETE };
