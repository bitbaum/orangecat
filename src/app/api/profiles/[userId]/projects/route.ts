import { logger } from '@/utils/logger';
import { apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { withOptionalAuth } from '@/lib/api/withAuth';
import { getTableName } from '@/config/entity-registry';
import { getUserActorId } from '@/domain/actors';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import { ENTITY_STATUS } from '@/config/database-constants';
import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export const GET = withOptionalAuth(async (request, context: RouteContext) => {
  try {
    const { userId } = await context.params;

    // Validate user ID
    const idValidation = getValidationError(validateUUID(userId, 'user ID'));
    if (idValidation) {
      return idValidation;
    }

    const { supabase } = request;

    // Get user's projects (simplified MVP - no organizations)
    // Exclude draft projects from public profiles - drafts should only show in dashboards
    const actorId = await getUserActorId(supabase, userId);
    if (!actorId) {
      return apiSuccess({ data: [], counts: { total: 0 } }, { cache: 'SHORT' });
    }
    const { data: projects, error: projectsError } = await supabase
      .from(getTableName('project'))
      .select(
        `
        id,
        title,
        description,
        category,
        tags,
        status,
        bitcoin_address,
        lightning_address,
        goal_amount,
        currency,
        raised_amount,
        created_at,
        updated_at,
        project_media(id, storage_path, position)
      `
      )
      .eq('actor_id', actorId)
      .neq('status', ENTITY_STATUS.DRAFT) // Exclude drafts from public profile view
      .order('created_at', { ascending: false });

    if (projectsError) {
      logger.error('Failed to fetch user projects', {
        userId,
        error: projectsError.message,
      });
      return apiInternalError('Failed to fetch projects');
    }

    type ProjectWithMedia = {
      id: string;
      title: string;
      description?: string | null;
      category?: string | null;
      tags?: string[] | null;
      status: string;
      bitcoin_address?: string | null;
      lightning_address?: string | null;
      goal_amount?: number | null;
      currency?: string | null;
      raised_amount?: number | null;
      bitcoin_balance_btc?: number | null;
      bitcoin_balance_updated_at?: string | null;
      created_at: string;
      updated_at: string;
      project_media: { id: string; storage_path: string; position: number }[] | null;
    };
    // Honest funding figures from the settled ledger — raised_amount is a dead
    // column nothing writes, so cards fed by this route would otherwise show 0.
    const enrichedProjects = await enrichProjectsWithSettledFunding(
      supabase,
      (projects || []) as ProjectWithMedia[]
    );

    // Process projects to get first media URL
    const projectsWithMedia = enrichedProjects.map((project: ProjectWithMedia) => {
      if (project.project_media && project.project_media.length > 0) {
        // Get first media item (sorted by position)
        const firstMedia = project.project_media.sort(
          (a: { position: number }, b: { position: number }) => a.position - b.position
        )[0];
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKETS.PROJECT_MEDIA)
          .getPublicUrl(firstMedia.storage_path);
        return {
          ...project,
          thumbnail_url: urlData.publicUrl,
          project_media: undefined, // Remove nested data
        };
      }
      return {
        ...project,
        thumbnail_url: null,
        project_media: undefined,
      };
    });

    logger.info('Fetched user projects successfully', {
      userId,
      count: projectsWithMedia.length,
    });

    return apiSuccess(
      {
        data: projectsWithMedia || [],
        counts: {
          total: projectsWithMedia?.length || 0,
        },
      },
      { cache: 'SHORT' }
    );
  } catch (error) {
    // userId may not be in scope if params failed; log without it
    logger.error('Unexpected error fetching user projects', { error });
    return apiInternalError('Failed to fetch projects');
  }
});
