/**
 * The health report has to reach somebody.
 *
 * `runCatHealthProbes()` already computed everything worth knowing — a vendor
 * retiring a pinned model, Groq being unable to serve a real Cat prompt, Cat
 * being unable to answer at all. Its only two callers were `/api/cat/diagnose`
 * and the `check_cat_health` action, so the answer existed ONLY when a human
 * thought to ask. Months of correct diagnosis, delivered to nobody.
 *
 * The rules below are the part that decides whether an operator's evening gets
 * interrupted, so they are tested without a database or a provider.
 *
 * The one that matters most is the one that does NOT alert. Groq cannot fit
 * Cat's prompt in its per-minute budget today, so every message falls through
 * to OpenRouter — true tonight, true every night, and the fallback works.
 * Paging for it nightly is how an alarm gets muted, which then costs you the
 * one night it means something.
 */
import { classifyHealth } from '@/services/cat/health-alert';
import type { CatHealthReport } from '@/services/cat/health-probes';

const healthy = (over: Partial<CatHealthReport> = {}): CatHealthReport =>
  ({
    probes: {
      groq: { provider: 'Groq', class: 'ok' },
      openrouter: { provider: 'OpenRouter', class: 'ok' },
    },
    missingFreeModels: [],
    missingGroqModels: [],
    groqCanServeCatPrompt: true,
    catCanAnswer: true,
    web: { reachable: true, detail: 'ok' },
    summary: 'Cat is healthy.',
    ...over,
  }) as CatHealthReport;

describe('what earns an alarm', () => {
  it('alerts when Cat cannot answer at all', () => {
    // Users are being turned away right now. Nothing outranks this.
    const v = classifyHealth(healthy({ catCanAnswer: false, summary: 'Cat cannot answer.' }));
    expect(v.alert).toBe(true);
    expect(v.alert && v.code).toBe('CAT_CANNOT_ANSWER');
  });

  it('alerts on a retired model, from either vendor', () => {
    // A pinned id the vendor no longer lists is a scheduled outage: it works
    // until the chain reaches it. Groq removed two llama models this way and a
    // consumer was silently down for eight days.
    for (const over of [
      { missingFreeModels: ['nvidia/nemotron-3:free'] },
      { missingGroqModels: ['llama-3.3-70b-versatile'] },
    ]) {
      const v = classifyHealth(healthy(over));
      expect(v.alert, JSON.stringify(over)).toBe(true);
      expect(v.alert && v.code).toBe('CAT_MODEL_ROT');
    }
  });

  it('names the retired models, so the alert is actionable', () => {
    const v = classifyHealth(healthy({ missingGroqModels: ['llama-3.3-70b-versatile'] }));
    expect(v.detail).toContain('llama-3.3-70b-versatile');
  });

  it('reports being unable to answer ahead of model rot', () => {
    // Both true at once: the operator needs the outage first.
    const v = classifyHealth(
      healthy({ catCanAnswer: false, missingGroqModels: ['gone-model'] })
    );
    expect(v.alert && v.code).toBe('CAT_CANNOT_ANSWER');
  });
});

describe('what must NOT earn an alarm', () => {
  it('does not page for the degradation we already live with', () => {
    // Groq cannot fit the prompt, so everything falls through to OpenRouter.
    // Serving, on one link, every night. Reported — not escalated.
    const v = classifyHealth(
      healthy({ groqCanServeCatPrompt: false, summary: 'Primary cannot serve Cat; fallback ok.' })
    );
    expect(v.alert).toBe(false);
    expect(v.alert === false && v.reason).toBe('degraded-but-serving');
    // And it still says what it saw: quiet is not the same as silent.
    expect(v.detail).toContain('fallback');
  });

  it('treats an unreadable catalogue as unknown, never as rot', () => {
    // null means "could not look" — no key, or the fetch failed. Reporting
    // every pinned id as retired because we could not look invents an outage;
    // treating it as fine hides one. Three states.
    const v = classifyHealth(healthy({ missingFreeModels: null, missingGroqModels: null }));
    expect(v.alert).toBe(false);
    expect(v.alert === false && v.reason).toBe('healthy');
  });

  it('is quiet when everything is fine', () => {
    const v = classifyHealth(healthy());
    expect(v.alert).toBe(false);
    expect(v.alert === false && v.reason).toBe('healthy');
  });

  it('notes unreachable web tools without waking anyone', () => {
    // Cat still answers; it just cannot look things up. Degraded, not down.
    const v = classifyHealth(healthy({ web: { reachable: false, detail: 'no search backend' } }));
    expect(v.alert).toBe(false);
    expect(v.alert === false && v.reason).toBe('degraded-but-serving');
  });
});

describe('the check is actually scheduled', () => {
  it('is wired to a cron route, not only to a human asking', () => {
    // The whole defect: the report was computed only by /api/cat/diagnose and
    // the check_cat_health action. A classifier nothing calls on a clock is the
    // same silence in a new file.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const route = fs.readFileSync(
      path.join(__dirname, '../../../src/app/api/cron/cat-health/route.ts'),
      'utf8'
    );
    expect(route).toContain('runCatHealthProbes()');
    expect(route).toContain('alertOnCatHealth(report)');
    // Cron routes are secret-gated like every other one.
    expect(route).toContain('verifyCronSecret(request)');
  });

  it('logs the run even when it decides not to alert', () => {
    // A run that quietly did nothing is indistinguishable from a run that never
    // happened — which is exactly how the nightly eval skipped two nights
    // without anyone noticing.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const route = fs.readFileSync(
      path.join(__dirname, '../../../src/app/api/cron/cat-health/route.ts'),
      'utf8'
    );
    expect(route).toContain("logger.info(\n      'cat provider health check'");
    expect(route).toContain('alerted: verdict.alert');
  });
});
