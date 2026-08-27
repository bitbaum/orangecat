/**
 * Domain availability via registry RDAP.
 *
 * The contract this module keeps: it never reports `unregistered` unless the
 * TLD appears in IANA's RDAP bootstrap AND the registry answered 404. Any
 * other outcome — TLD with no RDAP service, timeout, transport failure,
 * blocked redirect, unexpected status — is `unknown`. See
 * `src/config/domain-search.ts` for the false positive (orangecat.ch) that this
 * rule exists to prevent.
 *
 * Every request goes through `guardedFetch`, which validates each redirect hop
 * against the same SSRF policy this codebase applies to webhook URLs. The name
 * being looked up comes from a public query string, and rdap.org exists to
 * redirect — so the hosts actually contacted are chosen by a third party.
 *
 * Created: 2026-08-26
 */

import {
  DOMAIN_RESULT_TTL_MS,
  RDAP_BOOTSTRAP_TTL_MS,
  RDAP_BOOTSTRAP_URL,
  RDAP_CONCURRENCY,
  RDAP_QUERY_BASE,
  RDAP_TIMEOUT_MS,
  type DomainStatus,
} from '@/config/domain-search';
import { logger } from '@/utils/logger';
import { guardedFetch, type UrlGuard } from './guardedFetch';

export interface DomainResult {
  /** Full domain, lowercased: 'substrataintel.com'. */
  domain: string;
  /** Label part: 'substrataintel'. */
  name: string;
  tld: string;
  status: DomainStatus;
  /** Why the status is what it is — surfaced so nobody has to guess. */
  reason: string;
  /** True when this registry publishes RDAP, i.e. a definite answer was possible. */
  rdapSupported: boolean;
}

// ---------------------------------------------------------------------------
// Bootstrap: which TLDs can answer at all
// ---------------------------------------------------------------------------

let bootstrapCache: { tlds: Set<string>; fetchedAt: number } | null = null;

/**
 * TLDs that operate a public RDAP service, per IANA.
 *
 * On failure this returns null rather than an empty set — an empty set would
 * be indistinguishable from "no TLD supports RDAP" and would silently turn
 * every lookup into `unknown` without saying why.
 */
export async function loadRdapTlds(
  now: number = Date.now(),
  guard?: UrlGuard
): Promise<Set<string> | null> {
  if (bootstrapCache && now - bootstrapCache.fetchedAt < RDAP_BOOTSTRAP_TTL_MS) {
    return bootstrapCache.tlds;
  }
  try {
    const response = await guardedFetch(
      RDAP_BOOTSTRAP_URL,
      {
        signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      },
      guard
    );
    if (!response.ok) {
      logger.warn('RDAP bootstrap fetch failed', { status: response.status }, 'DomainSearch');
      return bootstrapCache?.tlds ?? null;
    }
    const body = (await response.json()) as { services?: Array<[string[], string[]]> };
    const tlds = new Set<string>();
    for (const service of body.services ?? []) {
      for (const tld of service[0] ?? []) {
        tlds.add(tld.toLowerCase());
      }
    }
    if (tlds.size === 0) {
      return bootstrapCache?.tlds ?? null;
    }
    bootstrapCache = { tlds, fetchedAt: now };
    return tlds;
  } catch (error) {
    logger.warn('RDAP bootstrap unreachable', { error: String(error) }, 'DomainSearch');
    // A stale set beats no answer; null means we have never had one.
    return bootstrapCache?.tlds ?? null;
  }
}

/** Test seam — resets both caches. */
export function resetDomainCaches(): void {
  bootstrapCache = null;
  resultCache.clear();
}

// ---------------------------------------------------------------------------
// Per-domain lookup
// ---------------------------------------------------------------------------

const resultCache = new Map<string, { result: DomainResult; fetchedAt: number }>();

/** Split 'substrataintel.com' into its label and TLD. Null if it isn't a domain. */
export function parseDomain(input: string): { name: string; tld: string } | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
  const match = /^([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.([a-z]{2,63})$/.exec(cleaned);
  if (!match) {
    return null;
  }
  const [, name, tld] = match;
  if (name.startsWith('-') || name.endsWith('-')) {
    return null;
  }
  return { name, tld };
}

function unknown(name: string, tld: string, reason: string, rdapSupported: boolean): DomainResult {
  return { domain: `${name}.${tld}`, name, tld, status: 'unknown', reason, rdapSupported };
}

/**
 * Look one domain up.
 *
 * @param rdapTlds the bootstrap set, or null when it could not be loaded.
 */
export async function checkDomain(
  input: string,
  rdapTlds: Set<string> | null,
  now: number = Date.now(),
  guard?: UrlGuard
): Promise<DomainResult> {
  const parsed = parseDomain(input);
  if (!parsed) {
    return unknown(input, '', 'Not a valid domain name.', false);
  }
  const { name, tld } = parsed;
  const domain = `${name}.${tld}`;

  const cached = resultCache.get(domain);
  if (cached && now - cached.fetchedAt < DOMAIN_RESULT_TTL_MS) {
    return cached.result;
  }

  if (!rdapTlds) {
    return unknown(name, tld, 'The RDAP registry list could not be loaded.', false);
  }
  if (!rdapTlds.has(tld)) {
    // The important branch. .ch, .io and .co land here — and a 404 from a
    // redirector for one of them means nothing at all.
    return unknown(
      name,
      tld,
      `The .${tld} registry publishes no RDAP service, so availability cannot be confirmed here.`,
      false
    );
  }

  let result: DomainResult;
  try {
    // `domain` matched a strict label/TLD regex above, so the path segment
    // cannot carry a scheme or a host; the base is a module constant. The
    // hosts that follow come from the redirector, and guardedFetch checks them.
    const response = await guardedFetch(
      `${RDAP_QUERY_BASE}/${encodeURIComponent(domain)}`,
      {
        signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
        headers: { accept: 'application/rdap+json, application/json' },
      },
      guard
    );

    if (response.status === 404) {
      result = {
        domain,
        name,
        tld,
        status: 'unregistered',
        reason: 'The registry reports no registration record for this name.',
        rdapSupported: true,
      };
    } else if (response.ok) {
      result = {
        domain,
        name,
        tld,
        status: 'registered',
        reason: 'The registry returned a registration record.',
        rdapSupported: true,
      };
    } else {
      result = unknown(
        name,
        tld,
        `The registry answered ${response.status}; treat as unresolved.`,
        true
      );
    }
  } catch (error) {
    const blocked = error instanceof Error && error.name === 'BlockedRequestError';
    result = unknown(
      name,
      tld,
      blocked
        ? 'The registry redirected somewhere this server will not follow.'
        : 'The registry did not answer in time.',
      true
    );
    logger.warn('RDAP lookup failed', { domain, error: String(error) }, 'DomainSearch');
  }

  resultCache.set(domain, { result, fetchedAt: now });
  return result;
}

/** Look several domains up, a few at a time so no registry is hammered. */
export async function checkDomains(domains: string[], guard?: UrlGuard): Promise<DomainResult[]> {
  const rdapTlds = await loadRdapTlds(Date.now(), guard);
  const results: DomainResult[] = [];

  for (let index = 0; index < domains.length; index += RDAP_CONCURRENCY) {
    const batch = domains.slice(index, index + RDAP_CONCURRENCY);
    results.push(
      ...(await Promise.all(batch.map(domain => checkDomain(domain, rdapTlds, Date.now(), guard))))
    );
  }
  return results;
}
