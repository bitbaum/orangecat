import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiValidationError,
  apiRateLimited,
  handleApiError,
  apiBadRequest,
} from '@/lib/api/standardResponse';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import { waitlistSchema } from '@/lib/validation/social';

export const POST = withOptionalAuth(async request => {
  try {
    const rl = await rateLimit(request as NextRequest);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const { user, supabase } = request;
    const body = await (request as NextRequest).json().catch(() => ({}));

    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const { email, source, referrer } = parsed.data;

    const { error } = await supabase.from(DATABASE_TABLES.CHANNEL_WAITLIST).insert({
      email,
      user_id: user?.id || null,
      source: source ?? 'channel_page',
      referrer: referrer ?? request.headers.get('referer') ?? null,
    });

    if (error) {
      logger.warn('Waitlist insert failed', { error: error.message });
      return apiValidationError('Failed to join waitlist. This email may already be registered.');
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
});
