import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';

type ProjectRow = {
  id: string;
  user_id?: string | null;
  [key: string]: unknown;
};

type ProfileRow = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
};

type FavoriteRow = {
  project_id: string;
  created_at: string;
};

/**
 * Get user's favorited projects
 * GET /api/projects/favorites
 */
async function handleGetFavorites(request: AuthenticatedRequest) {
  try {
    const { supabase, user } = request;

    // Get favorited project IDs
    const { data: favorites, error: favoritesError } = await supabase
      .from(DATABASE_TABLES.PROJECT_FAVORITES)
      .select('project_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (favoritesError) {
      logger.error('Failed to fetch favorites', {
        userId: user.id,
        error: favoritesError.message,
      });
      return apiInternalError('Failed to fetch favorites');
    }

    if (!favorites || favorites.length === 0) {
      // The array goes in `data` directly — see the note on the success return
      // below for why this must not be `{ data: [...] }`.
      return apiSuccess([], { total: 0, cache: 'SHORT' });
    }

    // Get full project data for favorited projects
    const projectIds = (favorites as FavoriteRow[]).map(f => f.project_id);
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
        bitcoin_balance_btc,
        bitcoin_balance_updated_at,
        created_at,
        updated_at,
        user_id
      `
      )
      .in('id', projectIds)
      .order('created_at', { ascending: false });

    if (projectsError) {
      logger.error('Failed to fetch favorited projects', {
        userId: user.id,
        projectCount: projectIds.length,
        error: projectsError.message,
      });
      return apiInternalError('Failed to fetch favorited projects');
    }

    // Fetch profiles separately for each project creator
    const userIds = [
      ...new Set(
        (projects || []).map((p: ProjectRow) => p.user_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const profilesMap = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id, username, name, avatar_url')
        .in('id', userIds);

      if (!profilesError && profiles) {
        (profiles as ProfileRow[]).forEach(profile => {
          profilesMap.set(profile.id, profile);
        });
      }
    }

    // Honest funding figures from the settled ledger (raised_amount is a dead
    // column — favorites cards would otherwise show 0 regardless of funding).
    const enrichedProjects = await enrichProjectsWithSettledFunding(
      supabase,
      (projects || []) as unknown as Array<ProjectRow & { currency?: string | null }>
    );

    // Map projects with favorite metadata and profiles
    const projectsWithFavorite = enrichedProjects.map((project: ProjectRow) => ({
      ...project,
      favorited_at: (favorites as FavoriteRow[]).find(f => f.project_id === project.id)?.created_at,
      profiles: project.user_id ? profilesMap.get(project.user_id) : null,
    }));

    logger.info('Fetched favorites successfully', {
      userId: user.id,
      count: projectsWithFavorite.length,
    });

    // The array is the payload; the count goes in `metadata.total`. This was
    // `apiSuccess({ data, count })`, nesting the rows two levels deep — so
    // useEntityList (which reads `data.data` and `data.metadata.total`, with
    // no transformResponse from useEntityDashboard) set `items` to the wrapper
    // object and `total` to 0, and the Favorites tab was dead. Same class as
    // the follow-list envelope behind #902.
    return apiSuccess(projectsWithFavorite, {
      total: projectsWithFavorite.length,
      cache: 'SHORT',
    });
  } catch (error) {
    logger.error('Unexpected error fetching favorites', { error });
    return apiInternalError('Internal server error');
  }
}

export const GET = withAuth(handleGetFavorites);
