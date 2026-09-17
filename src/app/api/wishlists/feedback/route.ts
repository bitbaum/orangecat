/**
 * Wishlist Feedback API
 *
 * POST /api/wishlists/feedback - Submit like/dislike feedback
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { wishlistFeedbackSchema } from '@/lib/validation';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  apiForbidden,
  apiConflict,
  apiInternalError,
  apiCreated,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await request.json();
    const v = wishlistFeedbackSchema.safeParse(body);
    if (!v.success) {
      return apiBadRequest('Invalid request', v.error.issues);
    }
    const d = v.data;

    // Verify wishlist item and ownership
    const { data: wishlistItem, error: itemError } = await supabase
      .from(DATABASE_TABLES.WISHLIST_ITEMS)
      .select('id, wishlist_id, wishlists!inner(actor_id)')
      .eq('id', d.wishlist_item_id)
      .single();
    if (itemError || !wishlistItem) {
      return apiNotFound('Wishlist item not found');
    }

    const wishlist = Array.isArray(wishlistItem.wishlists)
      ? wishlistItem.wishlists[0]
      : wishlistItem.wishlists;
    if (wishlist?.actor_id === user.id) {
      return apiForbidden('You cannot provide feedback on your own wishlist items');
    }

    // Verify proof exists if provided
    if (d.fulfillment_proof_id) {
      const { data: proof, error: proofError } = await supabase
        .from(DATABASE_TABLES.WISHLIST_FULFILLMENT_PROOFS)
        .select('id')
        .eq('id', d.fulfillment_proof_id)
        .eq('wishlist_item_id', d.wishlist_item_id)
        .single();
      if (proofError || !proof) {
        return apiNotFound('Fulfillment proof not found or does not match wishlist item');
      }
    }

    // Check for existing feedback
    let existingQuery = supabase
      .from(DATABASE_TABLES.WISHLIST_FEEDBACK)
      .select('id, feedback_type')
      .eq('user_id', user.id)
      .eq('wishlist_item_id', d.wishlist_item_id);
    if (d.fulfillment_proof_id) {
      existingQuery = existingQuery.eq('fulfillment_proof_id', d.fulfillment_proof_id);
    } else {
      existingQuery = existingQuery.is('fulfillment_proof_id', null);
    }
    const { data: existingFeedback, error: checkError } = await existingQuery;

    if (checkError) {
      logger.error('Failed to check existing feedback', {
        error: checkError.message,
        userId: user.id,
      });
      return apiInternalError('Failed to check existing feedback');
    }

    if (existingFeedback?.length > 0) {
      const existing = existingFeedback[0];
      if (existing.feedback_type === d.feedback_type) {
        return apiConflict('You have already provided this type of feedback');
      }

      // Update existing feedback (toggle like ↔ dislike)
      const { data: updated, error: updateError } = await supabase
        .from(DATABASE_TABLES.WISHLIST_FEEDBACK)
        .update({ feedback_type: d.feedback_type, comment: d.comment })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to update wishlist feedback', {
          error: updateError.message,
          feedbackId: existing.id,
          userId: user.id,
        });
        return apiInternalError('Failed to update feedback');
      }
      return apiSuccess(updated);
    }

    // Create new feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from(DATABASE_TABLES.WISHLIST_FEEDBACK)
      .insert({
        wishlist_item_id: d.wishlist_item_id,
        fulfillment_proof_id: d.fulfillment_proof_id,
        user_id: user.id,
        feedback_type: d.feedback_type,
        comment: d.comment,
      })
      .select()
      .single();

    if (feedbackError) {
      logger.error('Failed to create wishlist feedback', {
        error: feedbackError.message,
        userId: user.id,
      });
      return apiInternalError('Failed to create feedback');
    }

    return apiCreated(feedback);
  } catch (error) {
    logger.error('Error in POST /api/wishlists/feedback:', error);
    return apiInternalError();
  }
});
