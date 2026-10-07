/**
 * GET /api/things — everything the signed-in person made or joined, as the
 * My things page lists it. The command palette reads this so "find my draft
 * about the bakery" is one keystroke, not a walk through fifteen dashboards.
 * Thin: the query lives in listMyThings, the one producer of that list.
 */
import type { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { listMyThings } from '@/domain/things/service';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const things = await listMyThings(supabase, user.id);
    return apiSuccess({ things }) as NextResponse;
  } catch (error) {
    logger.error('[api/things] listing failed', { userId: user.id, error }, 'Things');
    return apiInternalError('Could not load your things.') as NextResponse;
  }
});
