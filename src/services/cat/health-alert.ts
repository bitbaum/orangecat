/**
 * Tell the operator when Cat's providers are in trouble — before a user finds out.
 *
 * `runCatHealthProbes()` already computes everything worth knowing: whether a
 * pinned model has been retired at the vendor, whether Groq can actually serve
 * a real Cat prompt, whether the web tools can reach anything, whether Cat can
 * answer at all. It has been computing it for months and telling NOBODY: its
 * only two callers are the `/api/cat/diagnose` route and the `check_cat_health`
 * action, so the answer exists only when a human thinks to ask.
 *
 * That is the same shape as `failure-alert.ts` was written for, one step
 * earlier: there, a user's turn failed and nobody was told. Here, the thing
 * that WILL fail a user's turn is visible in advance and nobody is told.
 *
 * What this deliberately does NOT do is page for the degradation we already
 * live with. Groq cannot fit Cat's prompt in its per-minute budget, so every
 * message falls through to OpenRouter — true today, true every night, and the
 * fallback works. An alarm that fires nightly for a known state is how an
 * alarm gets ignored, which then costs you the one night it means something.
 * So that is reported and not escalated.
 */
import { alertOps } from './ops-alert';
import type { CatHealthReport } from './health-probes';

/** Why this run did or did not raise an alarm. */
export type HealthAlertCode = 'CAT_CANNOT_ANSWER' | 'CAT_MODEL_ROT';

export type HealthVerdict =
  | { alert: false; reason: 'healthy' | 'degraded-but-serving'; detail: string }
  | { alert: true; code: HealthAlertCode; detail: string };

/**
 * Which pinned models the vendors no longer list.
 *
 * `null` means the catalogue could not be read — no key, or the fetch failed.
 * That is NOT rot: reporting every pinned id as retired because we could not
 * look would invent an outage, and treating it as fine would hide one. Three
 * states, as everywhere else in this codebase.
 */
function retiredModels(report: CatHealthReport): string[] {
  return [...(report.missingFreeModels ?? []), ...(report.missingGroqModels ?? [])];
}

/**
 * Decide whether this health report is worth waking someone for.
 *
 * Pure, so the rules can be tested without a database or a provider — the
 * rules are the part that matters, and the part that goes wrong.
 */
export function classifyHealth(report: CatHealthReport): HealthVerdict {
  // Worst first: users are being turned away right now.
  if (!report.catCanAnswer) {
    return {
      alert: true,
      code: 'CAT_CANNOT_ANSWER',
      detail: report.summary,
    };
  }

  // A retired model is a scheduled outage: it works until the chain reaches it.
  const retired = retiredModels(report);
  if (retired.length > 0) {
    return {
      alert: true,
      code: 'CAT_MODEL_ROT',
      detail: `Configured models the vendor no longer lists: ${retired.join(', ')}. ${report.summary}`,
    };
  }

  // Serving, but on one link with nothing behind it. Recorded, not escalated —
  // see the header. This is the standing state, not news.
  if (!report.groqCanServeCatPrompt || !report.web.reachable) {
    return { alert: false, reason: 'degraded-but-serving', detail: report.summary };
  }

  return { alert: false, reason: 'healthy', detail: report.summary };
}

/**
 * Run the classification and raise the alarm when it earns one.
 *
 * Returns the verdict either way so the caller (a cron route) can log what it
 * decided — a run that decided NOT to alert is a real answer, and a run that
 * silently did nothing is indistinguishable from a run that never happened.
 */
export async function alertOnCatHealth(report: CatHealthReport): Promise<HealthVerdict> {
  const verdict = classifyHealth(report);
  if (verdict.alert) {
    await alertOps({
      code: verdict.code,
      message: verdict.detail,
      source: 'cat/health',
    });
  }
  return verdict;
}
