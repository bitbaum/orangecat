/**
 * GET  /api/ai-assistants/talk — the talk home: companions, group chats and
 *      the fleet's bots in one list, newest activity first.
 * POST /api/ai-assistants/talk — make a companion in a minute: a name and a
 *      face. Its job is not typed into a form; it is said in the first chat
 *      and remembered (companion memory), the way the person would tell a new
 *      colleague what they are for.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiCreated,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { AVATAR_HUES, AVATAR_SHAPES, avatarPath } from '@/config/companion-avatars';
import { BORN_MAX_TOKENS, starterDefinition } from '@/config/companions';
import { SITE_ORIGIN } from '@/config/site-origin';
import { aiAssistantSchema } from '@/lib/validation';
import { createAssistant } from '@/services/ai/assistant-service';
import { loadTalkHome } from '@/services/companions/talk-home';
import { logger } from '@/utils/logger';

const quickCreateSchema = z.object({
  title: z.string().trim().min(1).max(100),
  shape: z.enum(AVATAR_SHAPES.map(s => s.id) as [string, ...string[]]).optional(),
  hue: z.enum(AVATAR_HUES.map(h => h.id) as [string, ...string[]]).optional(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    return apiSuccess(await loadTalkHome(request.supabase, request.user.id));
  } catch (error) {
    logger.error('talk home failed', error, 'TalkHomeAPI');
    return apiInternalError('Failed to load your companions');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many creation requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = quickCreateSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const { title, shape, hue } = parsed.data;
    const input = aiAssistantSchema.safeParse({
      title,
      system_prompt: starterDefinition(title),
      avatar_url: shape && hue ? `${SITE_ORIGIN}${avatarPath(shape, hue)}` : undefined,
      pricing_model: 'free',
      max_tokens_per_response: BORN_MAX_TOKENS,
    });
    if (!input.success) {
      return apiBadRequest(input.error.issues[0]?.message || 'Invalid request data');
    }
    const result = await createAssistant(supabase, user.id, input.data);
    if (!result.ok) {
      logger.error('quick create failed', result.dbError, 'TalkHomeAPI');
      return apiInternalError('Failed to create the companion');
    }
    return apiCreated(result.data);
  } catch (error) {
    logger.error('quick create crashed', error, 'TalkHomeAPI');
    return apiInternalError('Failed to create the companion');
  }
});
