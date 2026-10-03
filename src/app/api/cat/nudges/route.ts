/**
 * GET  /api/cat/nudges   — the user's active proactive nudges (regenerated if stale)
 * POST /api/cat/nudges   — { action: 'dismiss', id }  → hide a nudge (won't return)
 *
 * Nudges are cached in user_nudges and regenerated when the profile changed or
 * the cache is older than ~24h. Dismissed nudges never reappear (dedupe_key),
 * and a kind dismissed twice in 30 days is muted for 30 (nudge-policy.ts).
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiBadRequest, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateNudges } from '@/services/cat/nudges';
import { selectNudges, type DismissedNudge } from '@/services/cat/nudge-policy';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

const STALE_MS = 24 * 60 * 60 * 1000;

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { user } = req;

  // Admin client kept on purpose: user_nudges has no RLS policies (RLS is not
  // even enabled on it in the baseline schema), and generateNudges reads
  // search_queries, which is RLS-on with zero policies — a session client would
  // see nothing. Every user_nudges query below pins user_id explicitly.
  const db = createAdminClient() as any;

  const { data: existing } = await db
    .from(DATABASE_TABLES.USER_NUDGES)
    .select('id, nudge_type, title, body, cta_label, cta_url, score, generated_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('score', { ascending: false });

  // Staleness: regenerate if none, older than 24h, or the profile changed since.
  const newest = existing?.[0]?.generated_at ? new Date(existing[0].generated_at).getTime() : 0;
  let stale = !existing?.length || Date.now() - newest > STALE_MS;
  if (!stale) {
    // Own-profile read — the session client's RLS (public profile select) covers it.
    const { data: prof } = await req.supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (prof?.updated_at && new Date(prof.updated_at).getTime() > newest) {
      stale = true;
    }
  }

  if (!stale) {
    return apiSuccess({ nudges: existing, cached: true });
  }

  // Regenerate.
  try {
    const fresh = await generateNudges(db, user.id);
    const { data: dismissedRows } = await db
      .from(DATABASE_TABLES.USER_NUDGES)
      .select('dedupe_key, dismissed_at')
      .eq('user_id', user.id)
      .eq('status', 'dismissed');
    // Never a dismissed one again, one per kind, three at most, and a kind
    // dismissed twice this month stays quiet for a month (nudge-policy.ts).
    const toStore = selectNudges(fresh, (dismissedRows ?? []) as DismissedNudge[]);

    await db
      .from(DATABASE_TABLES.USER_NUDGES)
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (toStore.length > 0) {
      await db.from(DATABASE_TABLES.USER_NUDGES).upsert(
        toStore.map(n => ({
          user_id: user.id,
          nudge_type: n.nudge_type,
          title: n.title,
          body: n.body,
          cta_label: n.cta_label,
          cta_url: n.cta_url,
          dedupe_key: n.dedupe_key,
          score: n.score,
          status: 'active',
          generated_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,dedupe_key' }
      );
    }

    const { data: stored } = await db
      .from(DATABASE_TABLES.USER_NUDGES)
      .select('id, nudge_type, title, body, cta_label, cta_url, score, generated_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('score', { ascending: false });
    return apiSuccess({ nudges: stored ?? [], cached: false });
  } catch (err) {
    logger.error('nudges generation failed', { err }, 'Nudges');
    return apiSuccess({ nudges: existing ?? [], cached: true });
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { user } = req;
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'dismiss' || !body?.id) {
    return apiBadRequest('Bad request');
  }
  // Admin client kept on purpose: user_nudges has no RLS policies, so a session
  // client has no owner scoping to lean on — the user_id filter below is the guard.
  const db = createAdminClient() as any;
  await db
    .from(DATABASE_TABLES.USER_NUDGES)
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('id', body.id);
  return apiSuccess({ dismissed: true });
});
