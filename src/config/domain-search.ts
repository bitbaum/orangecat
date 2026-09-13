/**
 * Domain search — SSOT for the availability check /domains offers.
 *
 * Finding a name is the rung BEFORE the two services /domains already sells
 * (build me a site, host it at yourname.orangecat.ch). Somebody who does not
 * yet have a domain cannot buy hosting for one, so this closes the front of
 * that funnel — and it is the same capability Loki needs when it stands
 * up a customer, which is why the check lives behind a public v1 endpoint
 * rather than inside a React component.
 *
 * WHY THIS ASKS EACH REGISTRY DIRECTLY
 *
 * RDAP (RFC 7482) is the registries' own structured successor to WHOIS: free,
 * keyless, authoritative. The naive implementation asks a redirector
 * (rdap.org) for a domain and calls a 404 "available". Two things are wrong
 * with that, and this project shipped both:
 *
 * 1. A redirector cannot distinguish "no such domain" from "no such registry",
 *    so an unlisted TLD reads as free. That one was caught before launch.
 * 2. A redirector is a third party with its own availability. In production it
 *    began answering 403 to every query, which turned EVERY result into
 *    `unknown` — a search box that could not answer its own question, while
 *    still rendering as a working feature.
 *
 * So the query now goes to the registry named by IANA's bootstrap, which this
 * module already downloaded and previously used only as a yes/no gate while
 * discarding the very URLs that document exists to publish. No middleman is
 * left to fail.
 *
 * A TLD earns a definitive answer only when we hold its registry's own RDAP
 * base URL. Everything else returns `unknown`, and the UI says so. A search
 * tool that guesses is worse than one that admits the gap, because the guess
 * is what someone acts on.
 *
 * Created: 2026-08-26. Rewritten onto direct registry queries 2026-09-08.
 */

/** IANA's registry of which TLDs run RDAP, and where. Fetched, then used. */
export const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

/**
 * Registries that answer RDAP but are absent from IANA's bootstrap.
 *
 * Every entry here was verified in BOTH directions before being added — a
 * registered name returning 200 and an unregistered one returning 404 — because
 * an endpoint that 404s uniformly would manufacture exactly the false
 * "available" this whole module exists to prevent. Verified 2026-09-08:
 *
 *   .ch  google.ch, admin.ch → 200 · causius.ch, anwalte.ch → 404
 *   .io  github.io, google.io, nic.io → 200 · causius.io → 404
 *
 * `.ch` matters most: it is this platform's own TLD and its users' default, and
 * SWITCH began publishing RDAP after the original note here recorded that it
 * did not. That note stayed true-sounding and became wrong; re-verify these
 * rather than trusting the comment.
 *
 * Overrides deliberately take precedence over the bootstrap, so a registry that
 * IANA lists incorrectly can be corrected here without waiting for IANA.
 */
export const RDAP_REGISTRY_OVERRIDES: Readonly<Record<string, string>> = {
  ch: 'https://rdap.nic.ch/',
  io: 'https://rdap.identitydigital.services/rdap/',
};

/** Bootstrap is republished rarely; an hour of staleness costs nothing. */
export const RDAP_BOOTSTRAP_TTL_MS = 60 * 60 * 1000;

/** Per-domain result cache. Registrations do not change minute to minute. */
export const DOMAIN_RESULT_TTL_MS = 10 * 60 * 1000;

/**
 * Hard cap on remembered lookups.
 *
 * The cache key is a domain the CALLER chose, so without a ceiling this map
 * grows for as long as the process does — and on a self-hosted box that process
 * runs for weeks. A TTL alone does not bound it: expired entries are only
 * noticed when the same key is asked for again, which an enumerating caller
 * never does.
 */
export const DOMAIN_RESULT_CACHE_MAX = 5000;

/** One lookup's ceiling. A slow registry must not hold the whole search open. */
export const RDAP_TIMEOUT_MS = 8000;

/**
 * The bootstrap gets its own, longer ceiling.
 *
 * It is a large document listing ~1200 TLDs, served from a single host, and it
 * has been measured taking >20s. Sharing the per-lookup timeout meant one slow
 * fetch downgraded every TLD at once — the widest possible blast radius for the
 * slowest request in the module.
 */
export const RDAP_BOOTSTRAP_TIMEOUT_MS = 30000;

/** Concurrent RDAP requests. Polite to the registries, fast enough for a page. */
export const RDAP_CONCURRENCY = 6;

/** Hard cap on candidates per search, so one query cannot fan out unbounded. */
export const MAX_CANDIDATES = 24;

/**
 * TLDs offered by default, best-first.
 *
 * `.ch` leads because this is a Swiss platform and it is the right domain for
 * most of its users. It now also answers definitively — see the overrides above.
 */
export const CANDIDATE_TLDS: readonly string[] = [
  'com',
  'ch',
  'ai',
  'io',
  'dev',
  'org',
  'net',
  'xyz',
];

/**
 * Name shapes tried around a seed word. Deliberately short: a wall of
 * machine-generated names is noise, and the good name is usually the seed
 * itself or the seed plus one honest qualifier.
 */
export const NAME_PATTERNS: readonly { id: string; render: (seed: string) => string }[] = [
  { id: 'bare', render: seed => seed },
  { id: 'intel', render: seed => `${seed}intel` },
  { id: 'research', render: seed => `${seed}research` },
  { id: 'labs', render: seed => `${seed}labs` },
  { id: 'group', render: seed => `${seed}group` },
  { id: 'get', render: seed => `get${seed}` },
];

/** What a lookup can conclude. `unknown` is a first-class answer, not a failure. */
export type DomainStatus = 'registered' | 'unregistered' | 'unknown';

export const DOMAIN_STATUS_COPY: Record<DomainStatus, { label: string; detail: string }> = {
  registered: {
    label: 'Taken',
    detail: 'The registry holds a registration record for this name.',
  },
  unregistered: {
    label: 'No registration found',
    detail:
      'The registry reports no record. Premium pricing, registry reservations and ' +
      'trademark conflicts are not visible here — confirm at a registrar before you count on it.',
  },
  unknown: {
    label: 'Check manually',
    detail:
      'Nothing could be concluded either way for this name — no public RDAP service, ' +
      'or the registry did not answer. A registrar lookup is the only reliable answer.',
  },
};

/** Labels a domain the platform already knows about, so search never mis-sells one. */
export const DOMAIN_SEARCH_DISCLAIMER =
  'Availability is reported from registry RDAP records, not from a registrar. ' +
  'It is not a reservation, a price, or a guarantee that a name can be registered.';
