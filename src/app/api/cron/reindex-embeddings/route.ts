/**
 * Search-index reconciliation cron.
 *
 * Schedule: systemd timer `orangecat-cron@reindex-embeddings.timer` on bitbaum,
 * daily 03:30 UTC.
 *
 * WHY: index freshness relied entirely on per-row DB triggers that POST to a
 * HARDCODED https://orangecat.ch URL via pg_net. Any of — missing
 * private.reindex_config secret, pg_net unavailable, the box unable to reach
 * that host, a mismatched secret — makes a write silently skip indexing, with
 * nothing to notice or repair it. The reindex service's own docs describe a
 * "cron safety net"; it was never built. This is it.
 *
 * Incremental by default: only rows whose source updated_at is newer than the
 * stored embedding are re-embedded, so the daily run is cheap. Newly indexable
 * types (a type added to the allow-list) are picked up because they have no
 * stored row at all.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileCorpus } from '@/services/search/reindexService';
import { embeddingsEnabled } from '@/services/ai/embeddings';
import { logger } from '@/utils/logger';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }
  if (!embeddingsEnabled()) {
    // Not an error: a deployment without an embeddings key simply has no
    // semantic index. Say so rather than reporting a false success.
    return apiSuccess({ skipped: true, reason: 'embeddings_disabled' });
  }
  try {
    const admin = createAdminClient();
    const result = await reconcileCorpus(admin, { full: false });
    logger.warn('search index reconciled', { ...result }, 'CronReindex');
    return apiSuccess(result);
  } catch (error) {
    logger.error('search index reconcile crashed', { error }, 'CronReindex');
    return apiError('Reindex failed', 'INTERNAL_ERROR', 500);
  }
}
