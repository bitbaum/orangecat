/**
 * Cat Daily Brief Cron Route
 *
 * Schedule: systemd timer `orangecat-cron@cat-brief.timer` on bitbaum,
 * daily 06:30 UTC (morning in CH).
 *
 * For every user active with the Cat in the last 7 days, composes a short
 * data-only brief (sales, upcoming bookings, overdue tasks, unread
 * notifications) and delivers it as a notification linking to the Cat.
 * No LLM involved; nothing is sent when there's nothing to say, and the
 * run is idempotent per user per day.
 *
 * The run stops itself at BRIEF_RUN_BUDGET_MS, inside the timer's 120s curl
 * deadline. A run cut short answers 503 with its counts, so the unit still
 * fails and pages, but in time and with the app's own reason, instead of
 * `curl: (28) … 0 bytes received`. Users it did not reach get their brief from
 * the next run; the per-day dedupe makes a re-run safe.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { runDailyBrief } from '@/services/cat/daily-brief';
import { CRON } from '@/constants/cron';
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
    const result = await runDailyBrief(admin, CRON.BATCH_SIZE);
    logger.warn('cat daily brief run', { ...result }, 'CronCatBrief');
    if (result.outOfTime) {
      return apiError(
        `Daily brief ran out of time: ${result.briefsSent} sent, ${result.deferred} not reached`,
        'SERVICE_UNAVAILABLE',
        503,
        result
      );
    }
    return apiSuccess(result);
  } catch (error) {
    logger.error('cat daily brief crashed', { error }, 'CronCatBrief');
    return apiError('Daily brief run failed', 'INTERNAL_ERROR', 500);
  }
}
