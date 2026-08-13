/**
 * USER STATS API
 *
 * Returns aggregated user statistics for the recommendations system.
 * Single endpoint to get all data needed for dynamic task generation.
 */

import { apiSuccess, apiUnauthorized, handleApiError } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  buildUserContext,
  getRecommendedTasks,
  getSmartQuestions,
  getCelebrationMessage,
  getTaskCompletionPercentage,
} from '@/services/recommendations';
import { fetchUserStats } from '@/services/recommendations/fetchUserStats';

/**
 * GET /api/users/me/stats
 *
 * Returns comprehensive user statistics for recommendations:
 * profile completion, entity counts, wallet status, activity metrics,
 * recommended tasks, smart questions, and celebration messages.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const stats = await fetchUserStats(supabase, user.id);
    if (!stats) {
      return apiUnauthorized('Profile not found');
    }

    const {
      profile,
      entityCounts,
      hasWallet,
      daysSinceLastActivity,
      hasPublishedEntities,
      wishlistItemCount,
    } = stats;

    const userContext = buildUserContext(
      {
        id: profile.id,
        username: profile.username,
        display_name: profile.name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        bitcoin_address: profile.bitcoin_address,
        lightning_address: profile.lightning_address,
        website: profile.website,
        location: profile.location,
        preferred_currency: profile.preferred_currency,
      },
      { entityCounts, hasWallet, daysSinceLastActivity, hasPublishedEntities, wishlistItemCount }
    );

    return apiSuccess(
      {
        // Stable authenticated identity for read-only clients that need to
        // scope follow-up GETs to the current user. This endpoint already owns
        // the profile lookup, so exposing the user's own UUID avoids clients
        // calling bootstrap-capable profile routes just to recover it.
        profile: { id: profile.id, username: profile.username },
        profileCompletion: userContext.profileCompletion,
        entityCounts,
        hasWallet,
        hasPublishedEntities,
        daysSinceLastActivity,
        wishlistItemCount,
        taskCompletion: getTaskCompletionPercentage(userContext),
        recommendations: {
          tasks: getRecommendedTasks(userContext, { limit: 6 }),
          questions: getSmartQuestions(userContext, 3),
          celebration: getCelebrationMessage(userContext),
        },
      },
      { cache: 'SHORT' }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
