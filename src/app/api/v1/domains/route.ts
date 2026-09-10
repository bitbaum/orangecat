/**
 * GET /api/v1/domains?q=...&tlds=com,ch — is this name free anywhere?
 *
 * The rung before the two services /domains sells: somebody with no domain
 * cannot buy hosting for one. Public and keyless because registry RDAP records
 * are public — the same reasoning as /api/v1/demand and /api/v1/search.
 *
 * Shared surface by design. OrangeCat's /domains page and FleetCrown both call
 * this, so the honesty rules (a .ch "not found" is never reported as available)
 * are enforced once, server-side, instead of being re-implemented per client.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/standardResponse';
import {
  applyRateLimitHeaders,
  createRateLimitResponse,
  rateLimitDomainSearch,
} from '@/lib/rate-limit';
import { CANDIDATE_TLDS, DOMAIN_SEARCH_DISCLAIMER } from '@/config/domain-search';
import { checkDomains } from '@/services/domains/availability';
import { suggestDomains, toSeed } from '@/services/domains/suggest';
import { logger } from '@/utils/logger';

/** Registry lookups are slow and cached; let a CDN hold the answer briefly. */
const CACHE = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(request: NextRequest) {
  try {
    // Before any parsing, because the cost being rationed is the OUTBOUND fan-out
    // to the registries — up to MAX_CANDIDATES lookups per inbound request, on
    // behalf of an anonymous caller. See `rateLimitDomainSearch`.
    const limit = await rateLimitDomainSearch(request);
    if (!limit.success) {
      return createRateLimitResponse(limit);
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return apiError('Query "q" (min 2 chars) is required', 'BAD_REQUEST', 400);
    }

    const tldParam = url.searchParams.get('tlds');
    const tlds = tldParam
      ? tldParam
          .split(',')
          .map(tld => tld.trim().replace(/^\./, '').toLowerCase())
          .filter(tld => /^[a-z]{2,63}$/.test(tld))
      : undefined;

    const candidates = suggestDomains({ query: q, tlds });
    if (candidates.length === 0) {
      return apiError('Query contains no usable domain label', 'BAD_REQUEST', 400);
    }

    const results = await checkDomains(candidates);

    const response = apiSuccess({
      query: q,
      // The query reduced to a usable label ('Causius Legal' -> 'causiuslegal').
      // Returned rather than re-derived by callers: `toSeed` reaches
      // `parseDomain`, which pulls the server logger, so a browser deriving it
      // would drag server-only code into the client bundle. One field here
      // keeps that rule in one place for this app AND for FleetCrown.
      seed: toSeed(q),
      tlds: tlds ?? CANDIDATE_TLDS,
      // Callers that want only the confident answers can filter on this
      // without re-deriving the rule.
      counts: {
        unregistered: results.filter(r => r.status === 'unregistered').length,
        registered: results.filter(r => r.status === 'registered').length,
        unknown: results.filter(r => r.status === 'unknown').length,
      },
      results,
      disclaimer: DOMAIN_SEARCH_DISCLAIMER,
    });
    response.headers.set('Cache-Control', CACHE);
    return applyRateLimitHeaders(response, limit);
  } catch (err) {
    logger.error('GET /api/v1/domains failed', { err }, 'DomainSearch');
    return apiError('Domain search failed', 'INTERNAL_ERROR', 500);
  }
}
