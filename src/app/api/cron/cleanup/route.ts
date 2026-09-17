/**
 * Generic Cleanup Cron Route
 *
 * Schedule: systemd timer `orangecat-cron@cleanup.timer` on bitbaum,
 * daily 02:00 UTC.
 *
 * Housekeeping for plumbing tables that grow unbounded otherwise.
 * Each cleanup is independent — one failing doesn't stop the others —
 * and the response reports per-task counts so we can see what was pruned
 * in the journal.
 *
 * Today's tasks:
 *   - idempotency_results: delete rows past expires_at (24h TTL from
 *     the original migration). Without this, every API write
 *     accumulates a row forever; the cleanup keeps the table bounded
 *     to roughly one day of recent writes.
 *   - webhook_deliveries (delivered only): prune rows older than 30
 *     days. Failed + pending rows are kept — failed is the operator
 *     audit trail, pending is in-flight work the worker still owns.
 *
 * When you add another expirable plumbing table, add a new task to the
 * `tasks` array and the response will widen automatically.
 *
 * Created: 2026-06-03
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';
import { pruneDeliveredWebhookDeliveries } from '@/services/webhooks/deliveryService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOG_SOURCE = 'CronCleanup';

interface CleanupResult {
  task: string;
  deleted: number;
  error?: string;
}

async function pruneOldDeliveredWebhooks(): Promise<CleanupResult> {
  try {
    const deleted = await pruneDeliveredWebhookDeliveries();
    return { task: 'webhook_deliveries_delivered', deleted };
  } catch (error) {
    return {
      task: 'webhook_deliveries_delivered',
      deleted: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function pruneExpiredIdempotencyResults(): Promise<CleanupResult> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { count, error } = await admin
    .from(DATABASE_TABLES.IDEMPOTENCY_RESULTS)
    .delete({ count: 'exact' })
    .lt('expires_at', nowIso);

  if (error) {
    return {
      task: 'idempotency_results',
      deleted: 0,
      error: error.message,
    };
  }

  return { task: 'idempotency_results', deleted: count ?? 0 };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }

  try {
    const tasks: Array<() => Promise<CleanupResult>> = [
      pruneExpiredIdempotencyResults,
      pruneOldDeliveredWebhooks,
    ];

    const results = await Promise.all(tasks.map(task => task()));

    const summary = results.reduce<Record<string, number | string>>((acc, r) => {
      acc[r.task] = r.error ? `error: ${r.error}` : r.deleted;
      return acc;
    }, {});

    const hadError = results.some(r => r.error);
    if (hadError) {
      logger.error('Cleanup cron partial failure', { results }, LOG_SOURCE);
    } else {
      logger.warn('Cleanup cron completed', { results }, LOG_SOURCE);
    }

    return apiSuccess({
      ranAt: new Date().toISOString(),
      tasks: summary,
    });
  } catch (error) {
    logger.error(
      'Cleanup cron failed',
      { error: error instanceof Error ? error.message : error },
      LOG_SOURCE
    );
    return apiError('Internal error', 'INTERNAL_ERROR', 500);
  }
}
