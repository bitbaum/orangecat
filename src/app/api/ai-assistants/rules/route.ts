/**
 * The caller's own rules for their bots, and their time zone.
 *
 * GET /api/ai-assistants/rules — { rules, timeZone }
 * PUT /api/ai-assistants/rules — set both: { rules, timeZone }
 *
 * One row per person (user_ai_preferences), the caller's only. What the rules
 * do is services/companions/rules.ts.
 */
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import { MAX_BOT_RULES_LENGTH, getBotSettings, knownTimeZone } from '@/services/companions/rules';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  rules: z.string().max(MAX_BOT_RULES_LENGTH),
  timeZone: z.string().max(64).nullable(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const settings = await getBotSettings(request.supabase, request.user.id);
  return apiSuccess(settings, { headers: { 'Cache-Control': 'private, no-store' } });
});

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiBadRequest(`Rules are at most ${MAX_BOT_RULES_LENGTH} characters.`);
  }
  const zone = parsed.data.timeZone ? knownTimeZone(parsed.data.timeZone) : null;
  if (parsed.data.timeZone && !zone) {
    return apiBadRequest('That time zone is not one this app knows.');
  }
  try {
    const { error } = await fromTable(supabase, DATABASE_TABLES.USER_AI_PREFERENCES).upsert(
      {
        user_id: user.id,
        bot_rules: parsed.data.rules.trim() || null,
        time_zone: zone,
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      throw error;
    }
    return apiSuccess(await getBotSettings(supabase, user.id));
  } catch (error) {
    logger.error('Bot rules could not be saved', error, 'BotRulesAPI');
    return apiInternalError('The rules could not be saved.');
  }
});
