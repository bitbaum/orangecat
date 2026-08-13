/**
 * Wishlist Item Proofs API
 *
 * GET /api/wishlists/items/[itemId]/proofs - Get all proofs for a wishlist item
 */

import { withOptionalAuth } from '@/lib/api/withAuth';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { apiSuccess, apiNotFound, apiInternalError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { getUserActorId } from '@/domain/actors';

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

type Row = Record<string, any>;

function groupFeedbackByProof(feedback: Row[]): Record<string, Row[]> {
  return feedback.reduce((acc: Record<string, Row[]>, f: Row) => {
    if (f.fulfillment_proof_id) {
      acc[f.fulfillment_proof_id] = [...(acc[f.fulfillment_proof_id] || []), f];
    }
    return acc;
  }, {});
}

function enrichProof(
  proof: Row,
  feedbackMap: Record<string, Row[]>,
  userId: string | undefined
): Row {
  const proofFeedback = feedbackMap[proof.id] || [];
  return {
    id: proof.id,
    wishlist_item_id: proof.wishlist_item_id,
    user_id: proof.user_id,
    proof_type: proof.proof_type,
    description: proof.description,
    image_url: proof.image_url,
    transaction_id: proof.transaction_id,
    created_at: proof.created_at,
    creator: proof.profiles,
    feedback: {
      likes: proofFeedback.filter((f: Row) => f.feedback_type === 'like').length,
      dislikes: proofFeedback.filter((f: Row) => f.feedback_type === 'dislike').length,
      user_feedback: userId
        ? proofFeedback.find((f: Row) => f.user_id === userId)
          ? {
              type: proofFeedback.find((f: Row) => f.user_id === userId)!.feedback_type,
              comment: proofFeedback.find((f: Row) => f.user_id === userId)!.comment,
            }
          : null
        : null,
    },
  };
}

export const GET = withOptionalAuth(async (request, { params }: RouteParams) => {
  const { itemId } = await params;
  const idValidation = getValidationError(validateUUID(itemId, 'item ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user, supabase } = request;

    const { data: wishlistItem, error: itemError } = await supabase
      .from(DATABASE_TABLES.WISHLIST_ITEMS)
      .select('id, wishlist_id, wishlists!inner(actor_id)')
      .eq('id', itemId)
      .single();

    if (itemError || !wishlistItem) {
      return apiNotFound('Wishlist item not found');
    }

    const { data: proofsData, error: proofsError } = await supabase
      .from(DATABASE_TABLES.WISHLIST_FULFILLMENT_PROOFS)
      .select(
        'id, wishlist_item_id, user_id, proof_type, description, image_url, transaction_id, created_at, profiles:user_id(id, username, display_name, avatar_url)'
      )
      .eq('wishlist_item_id', itemId)
      .order('created_at', { ascending: false });

    if (proofsError) {
      logger.error('Failed to fetch wishlist proofs', { error: proofsError.message, itemId });
      return apiInternalError('Failed to fetch proofs');
    }

    const proofs = (proofsData ?? []) as Row[];
    let feedbackMap: Record<string, Row[]> = {};

    if (proofs.length > 0) {
      const { data: feedbackData } = await supabase
        .from(DATABASE_TABLES.WISHLIST_FEEDBACK)
        .select(
          'id, fulfillment_proof_id, user_id, feedback_type, comment, created_at, profiles:user_id(id, username, display_name, avatar_url)'
        )
        .in(
          'fulfillment_proof_id',
          proofs.map(p => p.id)
        );
      if (feedbackData) {
        feedbackMap = groupFeedbackByProof(feedbackData as Row[]);
      }
    }

    const wishlists = wishlistItem.wishlists as Row | Row[];
    const wishlist = Array.isArray(wishlists) ? wishlists[0] : wishlists;
    const actorId = user ? await getUserActorId(supabase, user.id) : null;

    return apiSuccess({
      proofs: proofs.map(proof => enrichProof(proof, feedbackMap, user?.id)),
      can_add_proof: Boolean(actorId && wishlist?.actor_id === actorId),
    });
  } catch (error) {
    logger.error('Error in GET /api/wishlists/items/[itemId]/proofs:', error);
    return apiInternalError();
  }
});
