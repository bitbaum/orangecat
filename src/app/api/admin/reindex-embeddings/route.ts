/**
 * POST /api/admin/reindex-embeddings — incremental semantic-index reconciler.
 *
 * Thin wrapper: auth (x-reindex-secret) + embeddings-enabled guard, then delegate
 * to src/services/search/reindexService. Two modes:
 *   - {entity_type, entity_id} body → single-row reconcile (DB trigger, ~instant).
 *   - no body → incremental corpus sweep (cron safety net); ?full=true re-embeds all.
 *
 * Decoupled from the write path on purpose: saving a profile never waits on an
 * embedding call; the reconciler converges the index in the background.
 */

import { apiSuccess, apiUnauthorized, apiServiceUnavailable } from '@/lib/api/standardResponse';
import { createAdminClient } from '@/lib/supabase/admin';
import { embeddingsEnabled } from '@/services/ai/embeddings';
import { reconcileOne, reconcileCorpus } from '@/services/search/reindexService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.REINDEX_SECRET;
  if (!secret || request.headers.get('x-reindex-secret') !== secret) {
    return apiUnauthorized();
  }
  if (!embeddingsEnabled()) {
    return apiServiceUnavailable('No embedding provider configured (set OPENAI_API_KEY).');
  }

  const supabase = createAdminClient();

  // Single-row reconcile: the DB trigger POSTs {entity_type, entity_id} on each
  // profile/entity write for near-instant indexing. No body (cron) ⇒ full sweep.
  let target: { entity_type?: string; entity_id?: string } = {};
  try {
    target = await request.json();
  } catch {
    /* no body — cron / manual full sweep */
  }
  if (target?.entity_type && target?.entity_id) {
    const r = await reconcileOne(supabase, String(target.entity_type), String(target.entity_id));
    return apiSuccess({ mode: 'single', ...r });
  }

  const full = new URL(request.url).searchParams.get('full') === 'true';
  const result = await reconcileCorpus(supabase, { full });
  return apiSuccess(result);
}
