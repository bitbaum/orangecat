/**
 * Project Favorites API
 *
 * GET    /api/projects/[id]/favorite - Check if favorited
 * POST   /api/projects/[id]/favorite - Add to favorites
 * DELETE /api/projects/[id]/favorite - Remove from favorites
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiInternalError, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { auditSuccess, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { rateLimitedFavoriteContext } from '@/lib/api/projectFavorites';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: AuthenticatedRequest, { params }: RouteContext) => {
  const { id: projectId } = await params;
  const idValidation = getValidationError(validateUUID(projectId, 'project ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { supabase } = request;
    const { data: favorite, error } = await supabase
      .from(DATABASE_TABLES.PROJECT_FAVORITES)
      .select('id')
      .eq('user_id', request.user.id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) {
      return apiInternalError('Failed to check favorite status');
    }
    return apiSuccess({ isFavorited: !!favorite });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest, { params }: RouteContext) => {
  const { id: projectId } = await params;
  const idValidation = getValidationError(validateUUID(projectId, 'project ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user, supabase } = request;
    const context = await rateLimitedFavoriteContext(request, projectId);
    if ('stop' in context) {
      return context.stop;
    }
    if (context.alreadyFavorited) {
      return apiSuccess({ isFavorited: true, message: 'Project already in favorites' });
    }

    const { error } = await supabase
      .from(DATABASE_TABLES.PROJECT_FAVORITES)
      .insert({ user_id: user.id, project_id: projectId });
    if (error) {
      return apiInternalError('Failed to add favorite');
    }

    await auditSuccess(AUDIT_ACTIONS.PROJECT_CREATED, user.id, 'project', projectId, {
      action: 'favorite',
      projectTitle: context.projectTitle,
    });
    logger.info('Project added to favorites', { userId: user.id, projectId });
    return apiSuccess({ isFavorited: true, message: 'Project added to favorites' });
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, { params }: RouteContext) => {
  const { id: projectId } = await params;
  const idValidation = getValidationError(validateUUID(projectId, 'project ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user, supabase } = request;
    const context = await rateLimitedFavoriteContext(request, projectId);
    if ('stop' in context) {
      return context.stop;
    }
    if (!context.alreadyFavorited) {
      return apiSuccess({ isFavorited: false, message: 'Project not in favorites' });
    }

    const { error } = await supabase
      .from(DATABASE_TABLES.PROJECT_FAVORITES)
      .delete()
      .eq('user_id', user.id)
      .eq('project_id', projectId);
    if (error) {
      return apiInternalError('Failed to remove favorite');
    }

    await auditSuccess(AUDIT_ACTIONS.PROJECT_CREATED, user.id, 'project', projectId, {
      action: 'unfavorite',
      projectTitle: context.projectTitle,
    });
    logger.info('Project removed from favorites', { userId: user.id, projectId });
    return apiSuccess({ isFavorited: false, message: 'Project removed from favorites' });
  } catch (error) {
    return handleApiError(error);
  }
});
