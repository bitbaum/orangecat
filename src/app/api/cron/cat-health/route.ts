/**
 * Cat Provider Health Cron Route
 *
 * Schedule: systemd timer `orangecat-cron@cat-health.timer` on bitbaum.
 *
 * `runCatHealthProbes()` already knew when a vendor had retired a pinned model,
 * when Groq could not serve a real Cat prompt, and when Cat could not answer at
 * all. Its only callers were the diagnose route and a Cat action, so the answer
 * existed only when a human thought to ask for it. This puts it on a clock.
 *
 * Cost, stated correctly after getting it wrong once: the catalogue checks are
 * GET /models and cost nothing, but probeGroq and probeOpenRouter send REAL
 * chat completions — a few tokens each, from the same free pools the check
 * exists to protect. Cheap, not free. That is why this runs daily rather than
 * hourly, and why the alert coalesces instead of stacking a row per run.
 */

import { runCatHealthProbes } from '@/services/cat/health-probes';
import { alertOnCatHealth } from '@/services/cat/health-alert';
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
    const report = await runCatHealthProbes();
    const verdict = await alertOnCatHealth(report);

    // WARN, not info, and that is the whole point of this line.
    //
    // The claim here used to be "logged either way, including when it decided
    // NOT to alert: a run that quietly did nothing is indistinguishable from a
    // run that never happened". It was written with logger.info, and in
    // production the logger's active level is `warn` — so every healthy run was
    // discarded and the guarantee was false exactly where it mattered. Checked
    // on the box 2026-09-13: a successful run (curl exit 0) left NO trace in
    // the journal at all.
    //
    // One line a day is a fair price for being able to prove the check ran. A
    // level chosen for tidiness that silently deletes the evidence is the same
    // mistake as an alert nobody receives.
    logger.warn(
      'cat provider health check',
      {
        alerted: verdict.alert,
        code: verdict.alert ? verdict.code : verdict.reason,
        catCanAnswer: report.catCanAnswer,
        groqCanServeCatPrompt: report.groqCanServeCatPrompt,
        detail: verdict.detail,
      },
      'CronCatHealth'
    );

    return apiSuccess({
      alerted: verdict.alert,
      code: verdict.alert ? verdict.code : verdict.reason,
      catCanAnswer: report.catCanAnswer,
      summary: report.summary,
    });
  } catch (error) {
    logger.error('cat provider health check crashed', { error }, 'CronCatHealth');
    return apiError('Cat health check failed', 'INTERNAL_ERROR', 500);
  }
}
