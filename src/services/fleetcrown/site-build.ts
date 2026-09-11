/**
 * Commissioning a real website for one of the user's projects.
 *
 * OrangeCat's promise is that anyone can build any project. Until now the
 * "build" half terminated in a button that handed the user a signed token and
 * asked them to go and sign in to a second product. FleetCrown's site factory
 * — which creates a repository, a subdomain, a certificate and a deploy in
 * about 35 seconds — has been live for weeks with no caller.
 *
 * This is the caller. It is deliberately thin: FleetCrown owns what a valid
 * slug is, which labels are reserved, how many sites an account may have, and
 * what status a machine-made site is allowed to claim. Re-deciding any of that
 * here would be a second copy of a policy that already exists, and the two
 * copies would diverge in the direction of whichever one was edited last.
 *
 * What DOES live here is the honesty. The factory answers 202 — queued — not
 * "built", because the repo, the box sync and the deploy take minutes. Every
 * sentence this module hands back to the model says so, because the failure
 * this product has already paid for is an agent reporting a side effect it
 * never saw land.
 */
import { postSignedToFleetCrown, fleetCrownRailConfigured } from './signed-post';
import { logger } from '@/utils/logger';

const SITE_URL =
  process.env.FLEETCROWN_SITE_URL || 'https://fleetcrown.orangecat.ch/api/orangecat/site';

/**
 * What a remote caller may ask for. A strict subset of the register's
 * vocabulary, mirroring what the door accepts — a site Cat commissions is a
 * demo, a product, or a client site, never `infra` and never a claim about a
 * customer relationship.
 */
export const CAT_SITE_KINDS = ['demo', 'product', 'client-site'] as const;
export type CatSiteKind = (typeof CAT_SITE_KINDS)[number];

/**
 * Subdomain grammar, checked here only so an obviously bad slug fails in the
 * conversation instead of a minute later in a queue. FleetCrown validates
 * again and its answer wins; this is UX, not a boundary.
 *
 * Deliberately the SAME expression as the authority's, because a client-side
 * check that is STRICTER than the real one is worse than no check at all: it
 * refuses things the factory would happily accept, and the user sees a
 * capability that looks broken with no way to tell it is our copy that is
 * wrong. A first draft here capped the length at 42 and would have rejected
 * every legal 43-to-63-character subdomain.
 */
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export type SiteBuildOutcome =
  { ok: true; host: string; url: string; commandId: string } | { ok: false; reason: string };

export interface SiteBuildInput {
  /** OrangeCat actor id the site is being built FOR. */
  actorId: string;
  slug: string;
  title: string;
  kind?: CatSiteKind;
  /** The OrangeCat page this was commissioned from, for attribution. */
  originUrl?: string;
}

/** Turn a title into a plausible subdomain, so the model rarely has to guess. */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
    .replace(/-+$/g, '');
}

export async function requestFleetCrownSite(input: SiteBuildInput): Promise<SiteBuildOutcome> {
  if (!fleetCrownRailConfigured()) {
    return {
      ok: false,
      reason:
        'Building sites is not configured on this deployment, so nothing was requested. Tell the user plainly rather than implying it is on its way.',
    };
  }

  const slug = input.slug?.trim().toLowerCase() ?? '';
  const title = input.title?.trim() ?? '';
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      reason: `"${slug}" cannot be a subdomain. Use lowercase letters, digits and hyphens, 2–42 characters, not starting or ending with a hyphen. Suggest one and ask the user to confirm.`,
    };
  }
  if (!title) {
    return { ok: false, reason: 'A site needs a title. Ask the user what it should be called.' };
  }

  const result = await postSignedToFleetCrown(SITE_URL, {
    actorId: input.actorId,
    slug,
    title: title.slice(0, 120),
    kind: input.kind ?? 'product',
    ...(input.originUrl ? { originUrl: input.originUrl } : {}),
  });

  if (!result.ok) {
    // The receiver's own sentence is worth more than our paraphrase: it is
    // written for a person and names the next step (409 → "sign in to
    // FleetCrown once"; 429 → the daily ceiling and why it exists).
    const detail = readDetail(result.body);
    logger.warn('[fc-site] build request refused', {
      actorId: input.actorId,
      slug,
      status: result.status,
    });
    return {
      ok: false,
      reason: detail
        ? `The build was NOT started: ${detail}`
        : `The build was NOT started: ${result.error}. Say so plainly and do not describe a site that does not exist.`,
    };
  }

  const parsed = parseSuccess(result.body);
  if (!parsed) {
    // 2xx with a body we cannot read is not a success we may report. Somewhere
    // between "it worked" and "it failed" is exactly the state an agent must
    // not paper over.
    return {
      ok: false,
      reason:
        'FleetCrown accepted the request but its answer could not be read, so it is unclear whether a build started. Tell the user to check FleetCrown rather than assuming either way.',
    };
  }
  return { ok: true, ...parsed };
}

function readDetail(body: string | undefined): string | null {
  if (!body) {
    return null;
  }
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; error?: unknown };
    const detail = typeof parsed.detail === 'string' ? parsed.detail : null;
    const error = typeof parsed.error === 'string' ? parsed.error : null;
    return detail ?? error;
  } catch {
    return null;
  }
}

function parseSuccess(body: string): { host: string; url: string; commandId: string } | null {
  try {
    const parsed = JSON.parse(body) as { host?: unknown; url?: unknown; commandId?: unknown };
    if (
      typeof parsed.host === 'string' &&
      typeof parsed.url === 'string' &&
      typeof parsed.commandId === 'string'
    ) {
      return { host: parsed.host, url: parsed.url, commandId: parsed.commandId };
    }
    return null;
  } catch {
    return null;
  }
}
