/**
 * Project Support API Route
 *
 * Handles project support operations (donations, signatures, messages, reactions).
 *
 * Created: 2025-01-30
 * Last Modified: 2026-01-28
 * Last Modified Summary: Refactored POST to use withAuth middleware
 */

import { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import projectSupportService from '@/services/projects/support';
import {
  supportProjectSchema,
  supportFiltersSchema,
  supportPaginationSchema,
} from '@/services/projects/support/validation';
import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiCreated,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/support - Get project support list
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params;
  const idValidation = getValidationError(validateUUID(projectId, 'project ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const filters = {
      support_type: searchParams.get('support_type') || undefined,
      is_anonymous:
        searchParams.get('is_anonymous') === 'true'
          ? true
          : searchParams.get('is_anonymous') === 'false'
            ? false
            : undefined,
      user_id: searchParams.get('user_id') || undefined,
    };

    // Parse pagination
    const rawLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const pagination = {
      page: searchParams.get('page') ? Math.max(1, parseInt(searchParams.get('page')!)) : undefined,
      limit: rawLimit !== undefined ? Math.min(100, Math.max(1, rawLimit)) : undefined,
      offset: searchParams.get('offset')
        ? Math.max(0, parseInt(searchParams.get('offset')!))
        : undefined,
    };

    // Validate filters and pagination
    const filtersValidation = supportFiltersSchema.safeParse(filters);
    const paginationValidation = supportPaginationSchema.safeParse(pagination);

    if (!filtersValidation.success || !paginationValidation.success) {
      return apiBadRequest('Invalid filters or pagination parameters');
    }

    // Get project support
    const result = await projectSupportService.getProjectSupport(
      projectId,
      filtersValidation.data,
      paginationValidation.data
    );

    return apiSuccess(result);
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/support:', error);
    return apiInternalError();
  }
}

// POST /api/projects/[id]/support - Create project support
export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id: projectId } = await context.params;
  const idValidation = getValidationError(validateUUID(projectId, 'project ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many support requests. Please slow down.', retryAfter);
    }

    const body = await request.json();

    // Validate request
    const validationResult = supportProjectSchema.safeParse(body);
    if (!validationResult.success) {
      return apiBadRequest('Invalid request', validationResult.error.issues);
    }

    // Create support
    const result = await projectSupportService.createProjectSupport(
      projectId,
      validationResult.data
    );

    if (!result.success) {
      return apiInternalError(apiErrorMessage(result, 'Failed to create support'));
    }

    return apiCreated(result.support);
  } catch (error) {
    logger.error('Error in POST /api/projects/[id]/support:', error);
    return apiInternalError();
  }
});
