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
 * Costs no tokens: the catalogue checks are GET /models, and the probes are the
 * same ones the diagnose route already runs. That is what makes it schedulable.
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

    // Logged either way, including when it decided NOT to alert: a run that
    // quietly did nothing is indistinguishable from a run that never happened,
    // which is how the nightly eval managed to skip for two nights unnoticed.
    logger.info(
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
