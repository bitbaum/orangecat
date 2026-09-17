/**
 * Domain availability via registry RDAP.
 *
 * The contract this module keeps: it never reports `unregistered` unless we
 * hold the TLD's own RDAP base URL AND that registry answered 404. Any other
 * outcome — TLD we have no registry for, timeout, transport failure,
 * unexpected status — is `unknown`. See `src/config/domain-search.ts` for the
 * two failures this rule exists to prevent.
 *
 * Created: 2026-08-26. Rewritten onto direct registry queries 2026-09-08.
 */

import {
  DOMAIN_RESULT_CACHE_MAX,
  DOMAIN_RESULT_TTL_MS,
  RDAP_BOOTSTRAP_TIMEOUT_MS,
  RDAP_BOOTSTRAP_TTL_MS,
  RDAP_BOOTSTRAP_URL,
  RDAP_CONCURRENCY,
  RDAP_REGISTRY_OVERRIDES,
  RDAP_TIMEOUT_MS,
  type DomainStatus,
} from '@/config/domain-search';
import { logger } from '@/utils/logger';

export interface DomainResult {
  /** Full domain, lowercased: 'substrataintel.com'. */
  domain: string;
  /** Label part: 'substrataintel'. */
  name: string;
  tld: string;
  status: DomainStatus;
  /** Why the status is what it is — surfaced so nobody has to guess. */
  reason: string;
  /** True when we hold this registry's RDAP base URL, i.e. a definite answer was possible. */
  rdapSupported: boolean;
}

/** TLD → that registry's RDAP base URL, always with a trailing slash. */
export type RdapRegistries = Map<string, string>;

// ---------------------------------------------------------------------------
// Bootstrap: which TLDs can answer, and where to ask them
// ---------------------------------------------------------------------------

let bootstrapCache: { registries: RdapRegistries; fetchedAt: number } | null = null;

/**
 * A base URL is only usable if it is absolute, https, and ends in a slash.
 *
 * The trailing slash is not cosmetic: `new URL('domain/x', base)` resolves
 * against the last path SEGMENT, so a base missing its slash would silently
 * drop `/v1` and query a path that does not exist — which returns a non-404
 * error and therefore reads as `unknown` rather than as a bug.
 */
function normaliseBase(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  return parsed.href.endsWith('/') ? parsed.href : `${parsed.href}/`;
}

/** The overrides, as a map. Built fresh so no caller can mutate the config. */
function overrideRegistries(): RdapRegistries {
  const map: RdapRegistries = new Map();
  for (const [tld, url] of Object.entries(RDAP_REGISTRY_OVERRIDES)) {
    const base = normaliseBase(url);
    if (base) {
      map.set(tld.toLowerCase(), base);
    }
  }
  return map;
}

/**
 * TLDs we can ask, mapped to the registry that answers for them.
 *
 * IANA's bootstrap is the bulk of it; the verified overrides are layered on top
 * and WIN, so a TLD IANA lists wrongly can be corrected without waiting on IANA.
 *
 * On bootstrap failure this still returns the overrides rather than null. The
 * old behaviour — null, meaning "conclude nothing" — let one unreachable
 * document disable TLDs whose registry URL is a compile-time constant and was
 * never in doubt. `.ch` is this platform's own TLD; it should not go dark
 * because data.iana.org is slow.
 */
export async function loadRdapRegistries(now: number = Date.now()): Promise<RdapRegistries> {
  if (bootstrapCache && now - bootstrapCache.fetchedAt < RDAP_BOOTSTRAP_TTL_MS) {
    return bootstrapCache.registries;
  }

  const overrides = overrideRegistries();

  try {
    const response = await fetch(RDAP_BOOTSTRAP_URL, {
      signal: AbortSignal.timeout(RDAP_BOOTSTRAP_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      logger.warn('RDAP bootstrap fetch failed', { status: response.status }, 'DomainSearch');
      return bootstrapCache?.registries ?? overrides;
    }

    const body = (await response.json()) as { services?: Array<[string[], string[]]> };
    const registries: RdapRegistries = new Map();
    for (const service of body.services ?? []) {
      const [tlds, urls] = service;
      const base = (urls ?? [])
        .map(normaliseBase)
        .find((candidate): candidate is string => Boolean(candidate));
      if (!base) {
        continue;
      }
      for (const tld of tlds ?? []) {
        registries.set(tld.toLowerCase(), base);
      }
    }

    if (registries.size === 0) {
      return bootstrapCache?.registries ?? overrides;
    }

    for (const [tld, base] of overrides) {
      registries.set(tld, base);
    }
    bootstrapCache = { registries, fetchedAt: now };
    return registries;
  } catch (error) {
    logger.warn('RDAP bootstrap unreachable', { error: String(error) }, 'DomainSearch');
    // A stale map beats no answer; the overrides beat an empty one.
    return bootstrapCache?.registries ?? overrides;
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

/**
 * Remember one lookup, without letting the caller decide how much we remember.
 *
 * Drops entries that are past their TTL, then — if the map is still at its
 * ceiling — the oldest ones, which a Map yields first because it iterates in
 * insertion order. Re-inserting an existing key deletes it first so a refreshed
 * entry counts as recently written rather than keeping its original position.
 */
function rememberResult(domain: string, result: DomainResult, now: number): void {
  resultCache.delete(domain);

  if (resultCache.size >= DOMAIN_RESULT_CACHE_MAX) {
    for (const [key, entry] of resultCache) {
      if (now - entry.fetchedAt >= DOMAIN_RESULT_TTL_MS) {
        resultCache.delete(key);
      }
    }
    while (resultCache.size >= DOMAIN_RESULT_CACHE_MAX) {
      const oldest = resultCache.keys().next();
      if (oldest.done) {
        break;
      }
      resultCache.delete(oldest.value);
    }
  }

  resultCache.set(domain, { result, fetchedAt: now });
}

/** @returns how many lookups are currently remembered. Test seam. */
export function domainCacheSize(): number {
  return resultCache.size;
}

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
 * @param registries TLD → RDAP base URL, or null when none could be resolved.
 */
export async function checkDomain(
  input: string,
  registries: RdapRegistries | null,
  now: number = Date.now()
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

  if (!registries) {
    return unknown(name, tld, 'The RDAP registry list could not be loaded.', false);
  }

  const base = registries.get(tld);
  if (!base) {
    // The important branch. A TLD with no known registry can never be called
    // free, however encouraging some other server's 404 might look.
    return unknown(
      name,
      tld,
      `The .${tld} registry publishes no RDAP service, so availability cannot be confirmed here.`,
      false
    );
  }

  // Join here rather than via `new URL(relative, base)`, which resolves against
  // the last path SEGMENT: a base that lost its trailing slash would silently
  // drop `/v1` and query a path that does not exist. `loadRdapRegistries`
  // normalises, but a caller passing its own map (Loki, tests) does not,
  // and an invariant enforced only at the far end is not enforced.
  const target = `${base.endsWith('/') ? base : `${base}/`}domain/${encodeURIComponent(domain)}`;

  let result: DomainResult;
  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      headers: { accept: 'application/rdap+json, application/json' },
      redirect: 'follow',
    });

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
    result = unknown(name, tld, 'The registry did not answer in time.', true);
    logger.warn('RDAP lookup failed', { domain, error: String(error) }, 'DomainSearch');
  }

  rememberResult(domain, result, now);
  return result;
}

/** Look several domains up, a few at a time so no registry is hammered. */
export async function checkDomains(domains: string[]): Promise<DomainResult[]> {
  const registries = await loadRdapRegistries();
  const results: DomainResult[] = [];

  for (let index = 0; index < domains.length; index += RDAP_CONCURRENCY) {
    const batch = domains.slice(index, index + RDAP_CONCURRENCY);
    results.push(...(await Promise.all(batch.map(domain => checkDomain(domain, registries)))));
  }
  return results;
}
