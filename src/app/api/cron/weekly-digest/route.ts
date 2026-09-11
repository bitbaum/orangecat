/**
 * Weekly Digest Cron Route
 *
 * Schedule: systemd timer `orangecat-cron@weekly-digest.timer` on bitbaum,
 * Mondays 08:00 UTC. (This route was unscheduled from creation until the
 * 2026-06 migration to systemd timers.)
 *
 * Processes users in batches of 50 to bound per-request work.
 *
 * Created: 2026-03-28
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { buildWeeklyDigest } from '@/services/notifications/digestBuilder';
import { NotificationEmailService } from '@/services/notifications/emailService';
import { logger } from '@/utils/logger';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';
import { CRON } from '@/constants/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOG_SOURCE = 'CronWeeklyDigest';
const BATCH_SIZE = CRON.BATCH_SIZE;

/** Returns IDs of users who should receive a weekly digest (explicit weekly pref, or no pref row = default weekly). */
async function getUserIdsForDigest(admin: SupabaseClient): Promise<string[]> {
  const [{ data: explicitWeekly }, { data: allPrefs }, { data: allProfiles }] = await Promise.all([
    admin
      .from(DATABASE_TABLES.NOTIFICATION_PREFERENCES)
      .select('user_id')
      // 'daily' is included deliberately. The UI offered Daily for months
      // while no daily job existed, and this query's `= 'weekly'` then
      // excluded those people from the only digest that ships — the more
      // engaged answer produced strictly less email. Until a daily job
      // exists, they get the weekly one. See settings/notifications.
      .in('digest_frequency', ['weekly', 'daily'])
      .eq('progress_emails', true),
    admin.from(DATABASE_TABLES.NOTIFICATION_PREFERENCES).select('user_id'),
    admin.from(DATABASE_TABLES.PROFILES).select('id'),
  ]);
  const weeklyIds = new Set((explicitWeekly ?? []).map((r: { user_id: string }) => r.user_id));
  const withPrefs = new Set((allPrefs ?? []).map((r: { user_id: string }) => r.user_id));
  return ((allProfiles ?? []) as { id: string }[])
    .filter(r => weeklyIds.has(r.id) || !withPrefs.has(r.id))
    .map(r => r.id);
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }

  const startTime = Date.now();
  const admin = createAdminClient();
  const emailService = new NotificationEmailService();
  let processed = 0,
    sent = 0,
    skipped = 0,
    failed = 0;

  try {
    const userIdsToProcess = await getUserIdsForDigest(admin);
    logger.info(
      `Weekly digest: ${userIdsToProcess.length} users to process`,
      { total: userIdsToProcess.length },
      LOG_SOURCE
    );

    for (let i = 0; i < userIdsToProcess.length; i += BATCH_SIZE) {
      const batch = userIdsToProcess.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async userId => {
          processed++;
          const digestData = await buildWeeklyDigest(userId);
          if (!digestData.hasContent) {
            skipped++;
            return { userId, status: 'skipped' as const };
          }

          const result = await emailService.sendNotificationEmail({
            userId,
            type: 'weekly_digest',
            data: {
              stats: digestData.stats,
              topEntities: digestData.topEntities,
              suggestions: digestData.suggestions,
            },
          });
          if (result.sent) {
            sent++;
            return { userId, status: 'sent' as const };
          }
          skipped++;
          return { userId, status: 'skipped' as const, reason: result.reason };
        })
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          failed++;
          logger.error(
            'Weekly digest failed for user in batch',
            { error: result.reason?.message ?? result.reason },
            LOG_SOURCE
          );
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      'Weekly digest cron completed',
      { processed, sent, skipped, failed, durationMs },
      LOG_SOURCE
    );
    return apiSuccess({ processed, sent, skipped, failed, durationMs });
  } catch (error) {
    logger.error(
      'Weekly digest cron failed',
      { error: error instanceof Error ? error.message : error },
      LOG_SOURCE
    );
    return apiError('Internal error', 'INTERNAL_ERROR', 500);
  }
}
