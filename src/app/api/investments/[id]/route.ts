/**
 * Investment CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { investmentSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import { createUpdatePayloadBuilder, entityTransforms } from '@/lib/api/buildUpdatePayload';

const buildInvestmentUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'investment_type' },
  { from: 'target_amount' },
  { from: 'minimum_investment' },
  { from: 'maximum_investment' },
  { from: 'expected_return_rate' },
  { from: 'return_frequency' },
  { from: 'term_months' },
  { from: 'end_date', transform: entityTransforms.emptyStringToNull },
  { from: 'risk_level' },
  { from: 'terms', transform: entityTransforms.emptyStringToNull },
  ...coverFieldMapping('investment'),
  { from: 'bitcoin_address', transform: entityTransforms.emptyStringToNull },
  { from: 'lightning_address', transform: entityTransforms.emptyStringToNull },
  { from: 'currency' },
  { from: 'is_public', default: false },
  // No default — see products/[id] note: a status default unpublishes on partial PUT.
  { from: 'status' },
]);

const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'investment',
  schema: investmentSchema,
  buildUpdatePayload: buildInvestmentUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
  requireAuthForGet: true,
  requireActiveStatus: false,
});

export { GET, PUT, DELETE };
