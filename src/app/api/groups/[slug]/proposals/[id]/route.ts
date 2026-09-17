import { NextRequest } from 'next/server';
import {
  handleApiError,
  apiSuccess,
  apiNotFound,
  apiBadRequest,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { getProposal } from '@/services/groups/queries/proposals';
import { updateProposal, deleteProposal } from '@/services/groups/mutations/proposals';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { z } from 'zod';

const updateProposalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  proposal_type: z.string().max(50).optional(),
  action_type: z.string().max(50).optional(),
  action_data: z.record(z.string(), z.unknown()).optional(),
  voting_threshold: z.number().int().min(1).max(100).optional(),
  voting_starts_at: z.string().datetime({ offset: true }).optional(),
  voting_ends_at: z.string().datetime({ offset: true }).optional(),
  is_public: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export const GET = withOptionalAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'proposal ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const result = await getProposal(id, request.supabase);
    if (!result.success) {
      return apiNotFound(result.error);
    }
    return apiSuccess(result.proposal);
  } catch (error) {
    logger.error('Error in GET /api/groups/[slug]/proposals/[id]', error, 'API');
    return handleApiError(error);
  }
});

export const PUT = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'proposal ID'));
  if (idValidation) {
    return idValidation;
  }
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await (request as NextRequest).json();
    const parsed = updateProposalSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid proposal data');
    }
    const result = await updateProposal(id, parsed.data, supabase);
    if (!result.success) {
      return apiBadRequest(result.error);
    }
    return apiSuccess(result.proposal);
  } catch (error) {
    logger.error('Error in PUT /api/groups/[slug]/proposals/[id]', error, 'API');
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'proposal ID'));
  if (idValidation) {
    return idValidation;
  }
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const result = await deleteProposal(id, supabase);
    if (!result.success) {
      return apiBadRequest(result.error);
    }
    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error('Error in DELETE /api/groups/[slug]/proposals/[id]', error, 'API');
    return handleApiError(error);
  }
});
