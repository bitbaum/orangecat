import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
  apiConflict,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, rateLimitSocialAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { auditSuccess, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { DATABASE_TABLES } from '@/config/database-tables';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';

const followBodySchema = z.object({
  following_id: z
    .string({ error: issue => issue.input === undefined ? 'following_id is required' : undefined })
    .guid('Invalid following_id format'),
});

async function handleFollow(request: AuthenticatedRequest) {
  try {
    const { supabase, user } = request;

    // Rate limiting check - 10 follows per minute
    const rateLimitResult = await rateLimitSocialAsync(user.id);
    if (!rateLimitResult.success) {
      return apiRateLimited(
        'Too many follow requests. Please slow down.',
        retryAfterSeconds(rateLimitResult)
      );
    }

    const parsed = followBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid following_id');
    }
    const { following_id } = parsed.data;

    // Prevent self-following
    if (user.id === following_id) {
      return apiBadRequest('Cannot follow yourself');
    }

    // Check if target user exists
    const { data: targetUser, error: userError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id')
      .eq('id', following_id)
      .single();

    if (userError || !targetUser) {
      return apiNotFound('User not found');
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', following_id)
      .single();

    if (existingFollow) {
      return apiConflict('Already following this user');
    }

    // Create follow relationship
    const { error: followError } = await supabase.from(DATABASE_TABLES.FOLLOWS).insert({
      follower_id: user.id,
      following_id: following_id,
    });

    if (followError) {
      logger.error('Error creating follow', {
        userId: user.id,
        followingId: following_id,
        error: followError.message,
      });
      return apiInternalError('Failed to follow user');
    }

    // Audit log follow action
    await auditSuccess(AUDIT_ACTIONS.USER_FOLLOWED, user.id, 'profile', following_id);

    // Notify the followed user (fire-and-forget)
    const { data: followerProfile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('name, username')
      .eq('id', user.id)
      .maybeSingle();
    const followerName: string = followerProfile?.name || followerProfile?.username || 'Someone';
    const followerUsername: string | null = followerProfile?.username ?? null;
    // Await before returning — fire-and-forget (`void dispatch(...)`)
    // was silently losing follow notifications in production. Adds
    // ~50ms to the response but guarantees delivery.
    try {
      await NotificationDispatcher.dispatch({
        userId: following_id,
        type: 'follow',
        title: `${followerName} followed you`,
        message: `${followerName} started following you on OrangeCat.`,
        sourceEntityType: 'profile',
        sourceEntityId: user.id,
        actionUrl: followerUsername ? `/profiles/${followerUsername}` : undefined,
      });
    } catch (notificationError) {
      logger.error('Failed to dispatch follow notification', {
        error: notificationError,
        following_id,
      });
      // Non-fatal: the follow itself succeeded.
    }

    logger.info('User followed successfully', {
      userId: user.id,
      followingId: following_id,
    });

    return applyRateLimitHeaders(apiSuccess({ following_id }, { status: 201 }), rateLimitResult);
  } catch (error) {
    logger.error('Unexpected error in POST /api/social/follow', { error });
    return apiInternalError('Internal server error');
  }
}

export const POST = withAuth(handleFollow);
