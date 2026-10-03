/**
 * Investments API - List and Create
 *
 * GET  /api/investments - List investments with pagination and filtering
 * POST /api/investments - Create a new investment
 */

import { investmentSchema } from '@/lib/validation';
import { createInvestment } from '@/domain/investments/service';
import type { CreateInvestmentRequest } from '@/types/investments';
import { createEntityListHandler } from '@/lib/api/entityListHandler';
import { createEntityPostHandler } from '@/lib/api/entityPostHandler';
import { INVESTMENT_PUBLIC_STATUSES } from '@/config/investments';

// GET /api/investments - List investments with pagination and filtering
export const GET = createEntityListHandler({
  entityType: 'investment',
  publicStatuses: [...INVESTMENT_PUBLIC_STATUSES],
  additionalFilters: { status: 'status', investment_type: 'investment_type' },
});

// POST /api/investments - Create a new investment
export const POST = createEntityPostHandler({
  entityType: 'investment',
  schema: investmentSchema,
  useActorOwnership: true,
  createEntity: async (userId, data, supabase) => {
    return await createInvestment(userId, data as unknown as CreateInvestmentRequest, supabase);
  },
});
