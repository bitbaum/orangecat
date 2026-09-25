/**
 * A photo attached in the Cat chat, for its owner only.
 *
 * GET /api/cat/attachments?path=<user-id>/cat/<uuid>.<ext>
 *
 * Redirects to a 10-minute signed URL. The path is checked against the
 * caller's own folder before anything is signed, so one user can never read
 * another's photo by guessing a path. See services/cat/chat-image-store.ts.
 */

import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiError, apiRateLimited, apiSuccess } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import {
  isOwnChatImagePath,
  publishChatImage,
  signedChatImageUrl,
} from '@/services/cat/chat-image-store';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const path = new URL(req.url).searchParams.get('path') ?? '';
  if (!isOwnChatImagePath(path, req.user.id)) {
    return apiError('Not found', 'NOT_FOUND', 404);
  }
  const url = await signedChatImageUrl(path);
  if (!url) {
    return apiError('Not found', 'NOT_FOUND', 404);
  }
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'private, max-age=300');
  return res;
});

/**
 * POST { path } → { url }: make the owner's chat photo public, for a listing
 * they are creating from it. Called when they act on a Cat draft — never
 * earlier, so a draft they ignore publishes nothing.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const rl = await rateLimitWriteAsync(req.user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof body?.path === 'string' ? body.path : '';
  const url = await publishChatImage(path, req.user.id);
  if (!url) {
    return apiError('Could not use that photo', 'NOT_FOUND', 404);
  }
  return apiSuccess({ url });
});
