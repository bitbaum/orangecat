/**
 * POST /api/ai-assistants/fleet/[slug]/ask — one line from a fleet bot, one to one.
 *
 * The conversation lives in the person's browser (the product on the far
 * side keeps nothing either; see Diplodoctor's /api/ask) — this route only
 * carries it there over the shared contract and brings the answer back, so
 * the browser's connect-src stays 'self'.
 */

import type { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiBadRequest, apiNotFound, apiRateLimited, apiSuccess } from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { fleetAskSchema, roomErrorResponse } from '@/lib/api/companion-rooms';
import { askFleetBot, fleetBot } from '@/services/companions/rooms/fleet';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { slug } = await context.params;
  const rl = await rateLimitWriteAsync(request.user.id);
  if (!rl.success) {
    return applyRateLimitHeaders(apiRateLimited('Rate limit exceeded', retryAfterSeconds(rl)), rl);
  }
  const parsed = fleetAskSchema.safeParse(await (request as NextRequest).json());
  if (!parsed.success) {
    return apiBadRequest('Validation failed', parsed.error.flatten());
  }
  const bot = await fleetBot(slug);
  if (!bot) {
    return apiNotFound('Fleet bot not found');
  }
  const answer = await askFleetBot(bot, parsed.data.messages, { signal: request.signal });
  if ('error' in answer) {
    return roomErrorResponse(answer.error);
  }
  return applyRateLimitHeaders(apiSuccess(answer), rl);
});
