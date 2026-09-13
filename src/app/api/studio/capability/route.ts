/**
 * GET /api/studio/capability — what can this user make right now?
 *
 * Answers per medium so the Studio can show every tab honestly: available ones
 * are usable, the rest say which key would unlock them instead of failing after
 * the user has typed a prompt.
 */

import type { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { providersForMedium, studioAccess } from '@/services/studio/access';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const access = await studioAccess(supabase, user.id);
    return apiSuccess({
      media: access.map(entry => ({
        ...entry,
        // Provider names are derived, never typed into the client, so the
        // "add a key for this" hint cannot drift from what the API accepts.
        unlockedBy: providersForMedium(entry.medium),
      })),
    }) as NextResponse;
  } catch (error) {
    logger.error('studio capability probe failed', error, 'StudioAPI');
    return apiInternalError('Could not check what the Studio can make right now.');
  }
});
