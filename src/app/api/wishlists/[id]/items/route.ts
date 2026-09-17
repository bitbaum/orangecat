/**
 * Wishlist Items API Route
 *
 * POST /api/wishlists/[id]/items — add an item to one of your wishlists.
 *
 * The wishlist UI ("Add Item" on /dashboard/wishlists/[id]) linked to an
 * add-item flow that was never built — this route plus
 * /dashboard/wishlists/items/new completes the loop. Validation is the
 * existing wishlistItemSchema (SSOT in src/lib/validation/wishlist.ts).
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { wishlistItemSchema } from '@/lib/validation';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  apiBadRequest,
  apiNotFound,
  apiForbidden,
  apiInternalError,
  apiCreated,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';

export const POST = withAuth(
  async (request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: wishlistId } = await params;
      const idValidation = getValidationError(validateUUID(wishlistId, 'wishlist ID'));
      if (idValidation) {
        return idValidation;
      }

      const { user, supabase } = request;

      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
      }

      const body = await request.json();
      const validationResult = wishlistItemSchema.safeParse(body);
      if (!validationResult.success) {
        return apiBadRequest('Invalid request', validationResult.error.issues);
      }

      // Ownership: the wishlist must belong to the caller's actor.
      const { data: wishlist, error: wishlistError } = await supabase
        .from(DATABASE_TABLES.WISHLISTS)
        .select('id, actor_id')
        .eq('id', wishlistId)
        .single();
      if (wishlistError || !wishlist) {
        return apiNotFound('Wishlist not found');
      }
      const actor = await getOrCreateUserActor(user.id);
      if ((wishlist as { actor_id: string }).actor_id !== actor.id) {
        return apiForbidden('You can only add items to your own wishlists');
      }

      const { data: item, error: itemError } = await supabase
        .from(DATABASE_TABLES.WISHLIST_ITEMS)
        .insert({ ...validationResult.data, wishlist_id: wishlistId })
        .select()
        .single();

      if (itemError) {
        logger.error(
          'Failed to create wishlist item',
          { wishlistId, error: itemError.message },
          'Wishlists'
        );
        return apiInternalError('Failed to add item');
      }

      return apiCreated({ item });
    } catch (error) {
      logger.error('Wishlist item POST error', { error }, 'Wishlists');
      return apiInternalError('Failed to add item');
    }
  }
);
