/**
 * Loan CRUD API Routes
 *
 * Uses generic entity handler from lib/api/entityCrudHandler.ts
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * Before refactoring: 192 lines
 * After refactoring: ~45 lines (76% reduction)
 */

import { coverFieldMapping } from '@/lib/entities/cover';
import { loanSchema } from '@/lib/validation';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';

// Build update payload from validated loan data
const buildLoanUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.uuidField('loan_category_id'), // UUID field - normalize empty strings
  { from: 'original_amount' },
  { from: 'remaining_balance' },
  { from: 'interest_rate' },
  { from: 'bitcoin_address', transform: entityTransforms.emptyStringToNull },
  { from: 'lightning_address', transform: entityTransforms.emptyStringToNull },
  // Currency: only include if explicitly provided (don't override existing value)
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
  { from: 'fulfillment_type' },
  { from: 'loan_type' },
  ...coverFieldMapping('loan'),
  // Refinancing fields (existing_refinance loans). createLoan persists these, but
  // the update builder omitted them — so editing a refinance loan silently dropped
  // its lender/rate details. (Caught by entity-update-builder-coverage guard.)
  { from: 'current_lender', transform: entityTransforms.emptyStringToNull },
  { from: 'current_interest_rate' },
  { from: 'desired_rate' },
  // Loan-specific fields
  { from: 'lender_name', transform: entityTransforms.emptyStringToNull },
  { from: 'loan_number', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.dateField('origination_date'), // Normalize date if present
  commonFieldMappings.dateField('maturity_date'), // Normalize date if present
  { from: 'monthly_payment' },
  { from: 'minimum_offer_amount' },
  { from: 'preferred_terms', transform: entityTransforms.emptyStringToNull },
  // UPDATE never re-applies create defaults — same fix as 4bf52070 on
  // wishlists. Earlier `default: true` here silently flipped private/
  // non-negotiable loans back to public+negotiable on partial PUT.
  { from: 'is_public' },
  { from: 'is_negotiable' },
  { from: 'show_on_profile' },
  { from: 'contact_method' },
]);

// Create handlers using generic factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'loan',
  schema: loanSchema,
  buildUpdatePayload: buildLoanUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
  requireAuthForGet: true, // Loans require auth to view
  requireActiveStatus: false, // Loans don't have an 'active' status filter
});

export { GET, PUT, DELETE };
