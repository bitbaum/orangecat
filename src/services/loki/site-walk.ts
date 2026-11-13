/**
 * A bot walks a live site, as the person: Loki opens each page in its own
 * browser at phone size and answers, per page, what is wrong with it.
 *
 * The QA half of Cat Bot (docs/PARITY.md, plan step 1). The browser is
 * Loki's, never this web process; the rail is the signed one, so only a
 * person whose actor is linked to a Loki account can walk. Read-only: a walk
 * files nothing. What it found is filed with file_loki_finding.
 */
import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';
import { logger } from '@/utils/logger';
import { postSignedToLoki } from './signed-post';

/** Loki's own ceilings for one walk. */
export const SITE_WALK_MAX_PAGES = 3;
export const SITE_WALK_MAX_PHRASES = 5;
/** Three pages at forty seconds each at the outside, and the queue for the one browser. */
const SITE_WALK_TIMEOUT_MS = 140_000;

export interface SiteWalkStep {
  url: string;
  ok: boolean;
  title: string | null;
  problems: string[];
}

export type SiteWalkOutcome =
  { ok: true; passed: boolean; steps: SiteWalkStep[] } | { ok: false; reason: string };

export function lokiSiteWalkUrl(): string {
  return (
    process.env.LOKI_SITE_WALK_URL ||
    new URL(LOKI_ENDPOINTS.siteWalk, ECOSYSTEM.loki.siteUrl).toString()
  );
}

/** The pages named in a bot's parameter: full addresses, in order, no repeats. */
export function parseWalkUrls(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const out: string[] = [];
  for (const item of list) {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!/^https?:\/\/\S+$/i.test(text) || out.includes(text)) {
      continue;
    }
    out.push(text);
  }
  return out;
}

/** The phrases every page must show: one per line or between semicolons. */
export function parseWalkPhrases(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[;\n]+/) : [];
  return list
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, SITE_WALK_MAX_PHRASES);
}

function safeJson(body: string | undefined): Record<string, unknown> | null {
  if (!body) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readSteps(raw: unknown): SiteWalkStep[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const steps: SiteWalkStep[] = [];
  for (const item of raw) {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    if (!rec || typeof rec.url !== 'string' || typeof rec.ok !== 'boolean') {
      return null;
    }
    steps.push({
      url: rec.url,
      ok: rec.ok,
      title: typeof rec.title === 'string' ? rec.title : null,
      problems: Array.isArray(rec.problems)
        ? rec.problems.filter((p): p is string => typeof p === 'string')
        : [],
    });
  }
  return steps;
}

export async function walkSiteWithLoki(input: {
  actorId: string;
  urls: string[];
  mustShow?: string[];
}): Promise<SiteWalkOutcome> {
  if (input.urls.length === 0) {
    return {
      ok: false,
      reason:
        'No page was named. A walk needs one to three full addresses (https://…). Ask which pages to open.',
    };
  }
  if (input.urls.length > SITE_WALK_MAX_PAGES) {
    return {
      ok: false,
      reason: `A walk opens at most ${SITE_WALK_MAX_PAGES} pages; ${input.urls.length} were named. Nothing was opened. Walk them ${SITE_WALK_MAX_PAGES} at a time.`,
    };
  }
  const expect = input.mustShow ?? [];
  const result = await postSignedToLoki(
    lokiSiteWalkUrl(),
    {
      actorId: input.actorId,
      issuedAt: new Date().toISOString(),
      steps: input.urls.map(url => ({ url, ...(expect.length ? { expect } : {}) })),
      // Words only across this rail for now: the picture stays in Loki.
      screenshots: false,
    },
    { timeoutMs: SITE_WALK_TIMEOUT_MS }
  );
  const parsed = safeJson(result.body);
  if (!result.ok) {
    logger.warn('[loki-site-walk] refused', { actorId: input.actorId, status: result.status });
    const detail =
      typeof parsed?.detail === 'string' && parsed.detail.trim() ? parsed.detail : null;
    return { ok: false, reason: `No page was walked: ${detail ?? result.error}` };
  }
  const steps = readSteps(parsed?.steps);
  if (!steps || steps.length === 0) {
    // A 2xx we cannot read is not a walk we may report.
    return {
      ok: false,
      reason:
        "Loki answered, but the walk's result could not be read. Say so, and don't invent one.",
    };
  }
  return { ok: true, passed: steps.every(s => s.ok), steps };
}

/** The lines the thread keeps for a walk: each page, and what is wrong with it. */
export function siteWalkMessage(o: Extract<SiteWalkOutcome, { ok: true }>): string {
  const failed = o.steps.filter(s => !s.ok).length;
  const head =
    failed === 0
      ? `Walked ${o.steps.length === 1 ? 'the page' : `${o.steps.length} pages`} at phone size: nothing wrong found.`
      : `Walked ${o.steps.length === 1 ? 'the page' : `${o.steps.length} pages`} at phone size: ${failed} ${failed === 1 ? 'has' : 'have'} problems.`;
  const lines = o.steps.map(s =>
    s.ok
      ? `- ${s.url}: fine${s.title ? ` (“${s.title}”)` : ''}.`
      : `- ${s.url}: ${s.problems.join(' ')}`
  );
  const tail =
    failed === 0
      ? 'This checks that each page loads, shows what it must, does not scroll sideways and has no broken picture; it is not a full test.'
      : 'Nothing was filed. A problem is filed into its project with file_loki_finding.';
  return [head, ...lines, tail].join('\n');
}
