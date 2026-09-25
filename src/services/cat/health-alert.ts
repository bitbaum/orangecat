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
 *
 * 2026-09-25: the nightly cron that fed this to alertOps is gone. Every probe
 * is a real completion against the free vendors, and the standing rule is that
 * a free-tier key is spent only when a person deliberately asks. What remains
 * is the classifier, for the person-initiated probe (/api/cat/diagnose, the
 * check_cat_health action).
 */
import type { CatHealthReport } from './health-probes';

/** Why this run did or did not raise an alarm. */
export type HealthAlertCode = 'CAT_CANNOT_ANSWER' | 'CAT_MODEL_ROT' | 'CAT_NO_VENDOR_REDUNDANCY';

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
 * Configured vendors whose free allowance is spent.
 *
 * `rate_limit` only — an auth failure or an upstream error is a different
 * problem with a different fix, and lumping them together would report "top up
 * your quota" for a revoked key. A vendor with no key configured is not
 * exhausted; it was never in the chain.
 */
function exhaustedVendors(report: CatHealthReport): string[] {
  return Object.values(report.probes)
    .filter(p => p.configured && p.class === 'rate_limit')
    .map(p => p.provider);
}

/** Configured vendors that answered a real request just now. */
function servingVendors(report: CatHealthReport): string[] {
  return Object.values(report.probes)
    .filter(p => p.configured && p.class === 'ok')
    .map(p => p.provider);
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

  // Every configured vendor but one has stopped serving. Cat still answers, so
  // this is not CAT_CANNOT_ANSWER — it is the state one outage away from it,
  // and nothing else reports it.
  //
  // Found by hand on 2026-09-13, which is the argument for the check: every
  // OpenRouter free model was answering "Rate limit exceeded:
  // free-models-per-day" (the allowance is 50/day without credits, and the
  // error offers 1000/day for 10), leaving Groq as the only vendor that could
  // serve. The product looked fine. Redundancy was gone and no signal said so.
  //
  // ACROSS VENDORS is the property worth guarding: a second model at the same
  // vendor draws on the SAME daily meter, so it is not a fallback once that
  // meter is spent. Only a different vendor has a different meter.
  //
  // Alerting on a condition that can recur nightly would normally be fatigue —
  // the reason `!groqCanServeCatPrompt` deliberately does NOT alert below. It
  // is acceptable here because alertOps coalesces by CODE: repeat firings bump
  // an occurrence count on one unread row rather than stacking new ones.
  const exhausted = exhaustedVendors(report);
  if (exhausted.length > 0 && servingVendors(report).length <= 1) {
    return {
      alert: true,
      code: 'CAT_NO_VENDOR_REDUNDANCY',
      detail:
        `Free allowance spent at: ${exhausted.join(', ')}. ` +
        `Cat is serving on one vendor with nothing behind it. ${report.summary}`,
    };
  }

  // Serving, but on one link with nothing behind it. Recorded, not escalated —
  // see the header. This is the standing state, not news.
  if (!report.groqCanServeCatPrompt || !report.web.reachable) {
    return { alert: false, reason: 'degraded-but-serving', detail: report.summary };
  }

  return { alert: false, reason: 'healthy', detail: report.summary };
}
