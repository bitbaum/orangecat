/**
 * Wishlist Proof API Route
 *
 * Handles wishlist fulfillment proof operations.
 *
 * POST /api/wishlists/proofs - Create proof of purchase/wishlist fulfillment
 *
 * Created: 2026-01-06
 * Last Modified: 2026-01-28
 * Last Modified Summary: Refactored to use withAuth middleware
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { wishlistFulfillmentProofSchema } from '@/lib/validation';
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

// POST /api/wishlists/proofs - Create proof of purchase/wishlist fulfillment
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const body = await request.json();

    // Validate request
    const validationResult = wishlistFulfillmentProofSchema.safeParse(body);
    if (!validationResult.success) {
      return apiBadRequest('Invalid request', validationResult.error.issues);
    }

    // Verify the wishlist item exists and user has access
    const { data: wishlistItem, error: itemError } = await supabase
      .from(DATABASE_TABLES.WISHLIST_ITEMS)
      .select('id, wishlist_id, wishlists!inner(actor_id)')
      .eq('id', validationResult.data.wishlist_item_id)
      .single();

    if (itemError || !wishlistItem) {
      return apiNotFound('Wishlist item not found');
    }

    // Users can only add proofs to their own wishlists
    const wishlist = Array.isArray(wishlistItem.wishlists)
      ? wishlistItem.wishlists[0]
      : wishlistItem.wishlists;
    if (!wishlist || wishlist.actor_id !== user.id) {
      return apiForbidden('You can only add proofs to your own wishlists');
    }

    // Create the proof
    const { data: proof, error: proofError } = await supabase
      .from(DATABASE_TABLES.WISHLIST_FULFILLMENT_PROOFS)
      .insert({
        wishlist_item_id: validationResult.data.wishlist_item_id,
        user_id: user.id,
        proof_type: validationResult.data.proof_type,
        description: validationResult.data.description,
        image_url: validationResult.data.image_url,
        transaction_id: validationResult.data.transaction_id,
      })
      .select()
      .single();

    if (proofError) {
      logger.error('Failed to create wishlist proof', {
        error: proofError.message,
        userId: user.id,
        wishlistItemId: validationResult.data.wishlist_item_id,
      });
      return apiInternalError('Failed to create proof');
    }

    logger.info('Created wishlist proof successfully', {
      proofId: proof.id,
      userId: user.id,
      wishlistItemId: validationResult.data.wishlist_item_id,
      proofType: validationResult.data.proof_type,
    });

    return apiCreated(proof);
  } catch (error) {
    logger.error('Error in POST /api/wishlists/proofs:', error);
    return apiInternalError();
  }
});
