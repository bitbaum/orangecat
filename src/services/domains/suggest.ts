/**
 * Turn what somebody typed into a short list of domains worth checking.
 *
 * Short on purpose. A hundred generated names is a wall nobody reads; the name
 * a person actually registers is almost always the seed itself, or the seed
 * plus one honest qualifier. So this generates the bare name across the
 * offered TLDs first — that is the answer most searches want — and only then
 * the patterned variants.
 *
 * Created: 2026-08-26
 */

import { CANDIDATE_TLDS, MAX_CANDIDATES, NAME_PATTERNS } from '@/config/domain-search';
import { parseDomain } from './availability';

export interface SuggestionInput {
  /** Whatever the user typed — a word, a phrase, or a full domain. */
  query: string;
  /** Override the offered TLDs (Loki passes its customer's preference). */
  tlds?: readonly string[];
}

/** Strip a query down to a usable domain label: 'Substrate Intel' → 'substrateintel'. */
export function toSeed(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 63);
}

/**
 * Candidate domains for a query, best-first and de-duplicated.
 *
 * If the query already names a domain ('substrataintel.com'), that exact
 * domain leads the list — someone who typed a full domain is asking about
 * that domain, and burying it under generated alternatives would be rude.
 */
export function suggestDomains(input: SuggestionInput): string[] {
  const tlds = (input.tlds?.length ? input.tlds : CANDIDATE_TLDS).map(tld =>
    tld.replace(/^\./, '').toLowerCase()
  );

  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (domain: string) => {
    if (!seen.has(domain) && candidates.length < MAX_CANDIDATES) {
      seen.add(domain);
      candidates.push(domain);
    }
  };

  const exact = parseDomain(input.query);
  if (exact) {
    push(`${exact.name}.${exact.tld}`);
  }

  const seed = toSeed(exact ? exact.name : input.query);
  if (!seed) {
    return candidates;
  }

  // The bare name across every offered TLD, before any invented variant.
  for (const tld of tlds) {
    push(`${seed}.${tld}`);
  }

  for (const pattern of NAME_PATTERNS) {
    if (pattern.id === 'bare') {
      continue;
    }
    const rendered = pattern.render(seed);
    for (const tld of tlds.slice(0, 3)) {
      push(`${rendered}.${tld}`);
    }
  }

  return candidates;
}
