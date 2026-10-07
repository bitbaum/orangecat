/**
 * Review Nudges Cron Route (ADR-0010)
 *
 * Schedule: systemd timer `orangecat-cron@review-nudges.timer` on bitbaum,
 * hourly.
 *
 * Asks each side of a deal that has not reviewed yet: a few days after the
 * deal settles, and again before the window closes. Deterministic, no model
 * call. Each nudge is recorded before it is sent, so it is never sent twice.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { runReviewNudges } from '@/domain/reputation/nudges';
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
    const result = await runReviewNudges(createAdminClient());
    // warn, not info: production drops info, and a run that sent nothing
    // visible is exactly the one worth being able to find.
    if (result.sent > 0 || result.skipped > 0) {
      logger.warn('review nudge run', { ...result }, 'CronReviewNudges');
    }
    return apiSuccess(result);
  } catch (error) {
    logger.error('review nudge run crashed', { error }, 'CronReviewNudges');
    return apiError('Review nudge run failed', 'INTERNAL_ERROR', 500);
  }
}
