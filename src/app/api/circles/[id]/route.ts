/**
 * Circle CRUD API Routes (GET/PUT/DELETE by id).
 * Generic CRUD handler; entity metadata from entity-registry (SSOT).
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { circleSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

const buildCircleUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'category', transform: entityTransforms.emptyStringToNull },
  { from: 'visibility' },
  ...coverFieldMapping('circle'),
  commonFieldMappings.arrayField('tags', []),
  // No default — see products/[id] note. Here a `default: 'active'` was the
  // opposite hazard: a partial PUT could silently re-activate a paused circle.
  { from: 'status' },
]);

const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'circle',
  schema: circleSchema,
  buildUpdatePayload: buildCircleUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
});

export { GET, PUT, DELETE };
