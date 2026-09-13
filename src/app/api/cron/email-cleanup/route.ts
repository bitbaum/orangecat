/**
 * Email Log Cleanup Cron Route
 *
 * Schedule: systemd timer `orangecat-cron@email-cleanup.timer` on bitbaum,
 * Sundays 02:00 UTC. (This route was unscheduled from creation until the
 * 2026-06 migration to systemd timers.)
 *
 * Deletes notification_email_log entries older than 90 days
 * to prevent unbounded table growth.
 *
 * Created: 2026-03-28
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute is plenty for cleanup

const LOG_SOURCE = 'CronEmailCleanup';
const RETENTION_DAYS = 90;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }

  try {
    const admin = createAdminClient();
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Count entries to be deleted (for reporting)
    const { count } = await admin
      .from(DATABASE_TABLES.NOTIFICATION_EMAIL_LOG)
      .select('*', { count: 'exact', head: true })
      .lt('sent_at', cutoffDate.toISOString());

    // Delete old log entries
    const { error } = await admin
      .from(DATABASE_TABLES.NOTIFICATION_EMAIL_LOG)
      .delete()
      .lt('sent_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Email log cleanup failed', { error }, LOG_SOURCE);
      return apiError('Cleanup query failed', 'INTERNAL_ERROR', 500);
    }

    const deleted = count ?? 0;

    logger.warn(
      'Email log cleanup completed',
      { deleted, cutoffDate: cutoffDate.toISOString() },
      LOG_SOURCE
    );

    return apiSuccess({ deleted, cutoffDate: cutoffDate.toISOString() });
  } catch (error) {
    logger.error(
      'Email log cleanup cron failed',
      { error: error instanceof Error ? error.message : error },
      LOG_SOURCE
    );

    return apiError('Internal error', 'INTERNAL_ERROR', 500);
  }
}
