/**
 * Solon reconciliation cron — heals missed webhooks.
 *
 * Schedule: systemd timer `orangecat-cron@solon-sync.timer` on bitbaum, daily.
 *
 * Lists closed allocation-policy sessions from Solon's public proposals API
 * and runs decision verification for any not yet applied locally. Idempotent:
 * verifyAndApplyDecision returns early for decisions already recorded, and
 * every application still goes through full local signature re-verification —
 * the cron grants no shortcuts.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAndApplyDecision } from '@/services/solon/decision-verify';
import { ALLOCATION_POLICY_KEY, SOLON_BASE_URL_DEFAULT, SOLON_ORG_SLUG } from '@/config/solon';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/standardResponse';
import { verifyCronSecret } from '@/lib/api/cronAuth';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SolonProposalListItem {
  policyKey: string | null;
  session: { id: string; status: string } | null;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return apiUnauthorized();
  }
  try {
    const base = process.env.SOLON_BASE_URL || SOLON_BASE_URL_DEFAULT;
    const res = await fetch(`${base}/api/orgs/${SOLON_ORG_SLUG}/proposals`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return apiError(`Solon proposals fetch failed: HTTP ${res.status}`, 'INTERNAL_ERROR', 502);
    }
    const { proposals } = (await res.json()) as { proposals: SolonProposalListItem[] };

    const closedPolicySessions = (proposals ?? [])
      .filter(p => p.policyKey === ALLOCATION_POLICY_KEY && p.session?.status === 'CLOSED')
      .map(p => p.session!.id);

    const admin = createAdminClient();
    const results = [];
    for (const sessionId of closedPolicySessions) {
      const result = await verifyAndApplyDecision(admin, sessionId);
      results.push({ decisionId: sessionId, ...result });
    }

    const summary = {
      checked: closedPolicySessions.length,
      applied: results.filter(r => r.applied && r.reason !== 'already applied').length,
      results,
    };
    logger.warn('solon-sync run', summary, 'CronSolonSync');
    return apiSuccess(summary);
  } catch (error) {
    logger.error('solon-sync crashed', { error }, 'CronSolonSync');
    return apiError('Solon sync failed', 'INTERNAL_ERROR', 500);
  }
}
