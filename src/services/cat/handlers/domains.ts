/**
 * Cat checks a domain name — against the registries, not against a search
 * engine's idea of them.
 *
 * The same RDAP pipeline /domains and Loki use (services/domains), so the
 * honesty rules hold once: a registry "not found" is 'unregistered', a
 * registry answer is 'registered', anything else is 'unknown' and said so.
 * Before this, Cat could only web_search a registrar's page — the guessy
 * path the pipeline was built to replace.
 */
import { CANDIDATE_TLDS } from '@/config/domain-search';
import { checkDomains } from '@/services/domains/availability';
import { recordDomainLookups } from '@/services/domains/record';
import { suggestDomains } from '@/services/domains/suggest';
import type { ActionHandler } from './types';

/** A phrase like "com, ch" or ".com .io" → ['com','io']; garbage is dropped. */
export function parseTlds(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const tlds = raw
    .split(/[\s,]+/)
    .map(t => t.trim().replace(/^\./, '').toLowerCase())
    .filter(t => /^[a-z]{2,63}$/.test(t));
  return tlds.length ? tlds : undefined;
}

export const domainHandlers: Record<string, ActionHandler> = {
  check_domain_availability: async (_supabase, _userId, actorId, params) => {
    const query = typeof params.query === 'string' ? params.query.trim() : '';
    if (query.length < 2) {
      return {
        success: false,
        error: 'A name to check is needed — a word, a phrase, or a full domain.',
      };
    }

    const tlds = parseTlds(params.tlds);
    const candidates = suggestDomains({ query, tlds });
    if (candidates.length === 0) {
      return { success: false, error: `"${query}" contains no usable domain label.` };
    }

    const results = await checkDomains(candidates);
    void recordDomainLookups(results, { source: 'cat', actorId });

    const free = results.filter(r => r.status === 'unregistered').map(r => r.domain);
    const taken = results.filter(r => r.status === 'registered').map(r => r.domain);
    const unknown = results.filter(r => r.status === 'unknown').map(r => r.domain);

    // A sentence for the model, with the one rule that matters spelled out:
    // 'unknown' is not 'free'. The registries that answered are the answer.
    const status =
      `Checked ${results.length} names against the registries. ` +
      (free.length ? `No registration found for: ${free.join(', ')}. ` : 'None were free. ') +
      (taken.length ? `Taken: ${taken.join(', ')}. ` : '') +
      (unknown.length
        ? `Could not verify (no registry answer, must be checked manually): ${unknown.join(', ')}. `
        : '') +
      'A name with no registration found can be registered at any registrar; OrangeCat is not one.';

    return {
      success: true,
      data: {
        query,
        tlds: tlds ?? CANDIDATE_TLDS,
        results: results.map(r => ({ domain: r.domain, status: r.status, reason: r.reason })),
        status,
      },
    };
  },
};
