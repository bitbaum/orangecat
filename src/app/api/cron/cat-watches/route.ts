/**
 * Cat Watch Evaluation Cron Route
 *
 * Schedule: systemd timer `orangecat-cron@cat-watches.timer` on bitbaum,
 * every 15 minutes.
 *
 * Evaluates active cat_watches rows ("tell me when funding reaches X",
 * "when someone books me") and fires a notification for each condition
 * that has become true. Firing marks the watch 'fired' first, so a crash
 * can only lose a notification, never duplicate one.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { runWatchEvaluation } from '@/services/cat/proactive';
import { logger } from '@/utils/logger';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }
  try {
    const admin = createAdminClient();
    const result = await runWatchEvaluation(admin);
    if (result.fired > 0 || result.errors > 0) {
      logger.warn('cat watch run', { ...result }, 'CronCatWatches');
    }
    return apiSuccess(result);
  } catch (error) {
    logger.error('cat watch run crashed', { error }, 'CronCatWatches');
    return apiError('Watch evaluation failed', 'INTERNAL_ERROR', 500);
  }
}
