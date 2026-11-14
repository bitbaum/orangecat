/**
 * POST /api/cat/first-answer: one real Cat answer for a visitor with no
 * account (the home page's door). See src/services/cat/first-answer.ts.
 *
 * A platform model call from a stranger, so it is held to the visitor budget
 * the Studio and dictation use (visitorOrUserBudget): the general per-IP
 * budget, then this feature's own, three an hour. Nothing is stored.
 */
import type { NextResponse } from 'next/server';
import { SITE_URL } from '@/config/brand';
import { withOptionalAuth } from '@/lib/api/withAuth';
import { visitorOrUserBudget } from '@/lib/api/dictationBudget';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/api/standardResponse';
import { createRateLimitResponse, rateLimitFirstAnswer } from '@/lib/rate-limit';
import { firstAnswerSchema } from '@/lib/validation';
import { answerFirstSentence } from '@/services/cat/first-answer';

export const POST = withOptionalAuth(async request => {
  // The page's own form only: this is not a public completion endpoint.
  const origin = request.headers.get('origin');
  if (origin !== request.nextUrl.origin && origin !== new URL(SITE_URL).origin) {
    return apiError('Ask the Cat on OrangeCat.', 'INVALID_ORIGIN', 403);
  }
  const limit = await visitorOrUserBudget(request, request.user?.id ?? null, rateLimitFirstAnswer);
  if (!limit.success) {
    return createRateLimitResponse(limit) as NextResponse;
  }
  const body = await request.json().catch(() => null);
  const parsed = firstAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest('Say what you want to do in a sentence.', parsed.error.issues);
  }
  const answer = await answerFirstSentence(parsed.data.sentence);
  if (!answer) {
    return apiError('The Cat cannot answer right now.', 'AI_UNAVAILABLE', 503);
  }
  return apiSuccess({ answer });
});
