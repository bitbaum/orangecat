import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getOwnOfferings, setOwnOfferingsSharing } from '@/domain/profile/offerings';

const sharingSchema = z.object({ enabled: z.boolean() }).strict();

export const GET = withAuth(async ({ user, supabase }: AuthenticatedRequest) => {
  try {
    return apiSuccess(await getOwnOfferings(supabase, user.id));
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const limit = await rateLimitWriteAsync(request.user.id);
    if (!limit.success) {
      return apiRateLimited('Too many requests. Please try again later.', retryAfterSeconds(limit));
    }
    const body = await request.json().catch(() => null);
    const parsed = sharingSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Choose whether to make your offerings public.');
    }
    return apiSuccess(
      await setOwnOfferingsSharing(request.supabase, request.user.id, parsed.data.enabled)
    );
  } catch (error) {
    return handleApiError(error);
  }
});
