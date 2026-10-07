import { apiSuccess } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

/**
 * Log a COMMITTED search query as an aggregate demand signal (feeds demand-grounded
 * growth + reveals unmet demand). Privacy by design: we persist the query text and an
 * optional result count, never the user — identity is used ONLY to gate the endpoint
 * against spam, then discarded. Always returns success; logging must never disrupt search.
 */
export async function POST(request: Request) {
  try {
    const auth = await createServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return apiSuccess({ ok: true });
    }

    // Over-quota callers get the same always-success contract — just skip the
    // write. Logging must never disrupt search, but writes stay bounded.
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiSuccess({ ok: true });
    }

    const body = (await request.json().catch(() => ({}))) as {
      query?: unknown;
      resultCount?: unknown;
    };
    const query = String(body.query ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 120);
    if (query.length < 2) {
      return apiSuccess({ ok: true });
    }
    const resultCount =
      typeof body.resultCount === 'number' && Number.isFinite(body.resultCount)
        ? Math.max(0, Math.trunc(body.resultCount))
        : null;

    // The admin client is the only writer of search_queries (RLS-on, no policies).
    const db = createAdminClient();
    await db.from(DATABASE_TABLES.SEARCH_QUERIES).insert({ query, result_count: resultCount });

    return apiSuccess({ ok: true });
  } catch (err) {
    logger.warn('search log failed', { err: String(err) }, 'Search');
    return apiSuccess({ ok: true });
  }
}
