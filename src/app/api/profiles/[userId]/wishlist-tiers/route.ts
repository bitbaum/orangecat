/**
 * Wishlist Donation Tiers API Route
 *
 * Fetches top wishlist items for a user to be used as donation tiers.
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 * Last Modified Summary: Created API to fetch wishlist items as donation tiers
 */

import { apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { withOptionalAuth } from '@/lib/api/withAuth';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getUserActorId } from '@/domain/actors';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export const GET = withOptionalAuth(async (request, context: RouteContext) => {
  const { userId } = await context.params;
  const idValidation = getValidationError(validateUUID(userId, 'user ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { supabase } = request;
    const actorId = await getUserActorId(supabase, userId);
    if (!actorId) {
      return apiSuccess({ items: [] });
    }

    // Fetch active wishlists for this user
    // We filter items that are not fully funded and not fulfilled
    const { data: items, error } = await supabase
      .from(DATABASE_TABLES.WISHLIST_ITEMS)
      .select(
        `
        id,
        title,
        target_amount_btc,
        funded_amount_btc,
        wishlists!inner(actor_id)
      `
      )
      .eq('wishlists.actor_id', actorId)
      .eq('is_fulfilled', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      logger.error('Failed to fetch wishlist tiers', { error: error.message, userId });
      return apiInternalError('Failed to fetch wishlist tiers');
    }

    return apiSuccess({ items: items || [] });
  } catch (error) {
    logger.error('Error in wishlist-tiers API:', error);
    return apiInternalError();
  }
});
