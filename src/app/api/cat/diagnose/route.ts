/**
 * Cat Diagnose
 *
 * Authenticated endpoint that hits each configured AI provider with a
 * minimal probe ("ping") and returns the raw upstream status + sanitized
 * error message. Built specifically so users (and us) can answer the
 * question "why isn't Cat answering?" without having to read server
 * logs.
 *
 * Probe logic lives in src/services/cat/health-probes.ts — shared with the
 * Cat's own check_cat_health tool so the Cat can run the same diagnosis
 * in-conversation. No keys, no auth headers, no Bearer strings are ever
 * echoed back — the result is always safe to surface to the user.
 *
 * GET /api/cat/diagnose
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/standardResponse';
import { runCatHealthProbes } from '@/services/cat/health-probes';
import { DEFAULT_GROQ_MODEL } from '@/services/ai/groq';
import {
  getGroqObservations,
  getGroqTpmLimit,
  getOpenRouterFreeStatus,
} from '@/services/ai/groq-capacity';

export const GET = withAuth(async (_request: AuthenticatedRequest) => {
  const report = await runCatHealthProbes();
  // The pool's headroom, in the same sentence as the health verdict — a
  // healthy provider with no requests left today is not a Cat that answers.
  const groq = getGroqObservations().find(o => o.model === DEFAULT_GROQ_MODEL) ?? null;
  const openrouter = getOpenRouterFreeStatus();
  const lines: string[] = [];
  if (groq) {
    lines.push(
      `Groq free pool: ${groq.remainingRequests ?? '?'} of ${groq.limitRequests ?? '?'} requests left today, ${groq.remainingTokens ?? '?'} of ${groq.limitTokens ?? getGroqTpmLimit(DEFAULT_GROQ_MODEL)} tokens this minute.`
    );
  }
  if (openrouter.dailyCapHitAt && openrouter.resetsAt) {
    lines.push(`OpenRouter free models: daily cap hit, resets at 00:00 UTC.`);
  }
  return apiSuccess({
    ...report,
    summary: lines.length ? `${report.summary} ${lines.join(' ')}` : report.summary,
    capacity: { groq, openrouter },
  });
});
