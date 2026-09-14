/**
 * Remember what was checked.
 *
 * The RDAP answer itself is cached in memory (availability.ts) so repeated
 * checks cost nothing; THIS is the durable trail — one row per name per check
 * — so a person can ask "what did I look at last week", a watch on a taken
 * name can be built later, and the names people actually want are a dataset
 * rather than a log line.
 *
 * Fire-and-forget by contract: never throws, never blocks the answer. A
 * failed write loses one row of history, not a search result.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import { fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import type { DomainResult } from './availability';

export type LookupSource = 'web' | 'cat';

export async function recordDomainLookups(
  results: DomainResult[],
  opts: { source: LookupSource; actorId?: string | null }
): Promise<void> {
  if (results.length === 0) {
    return;
  }
  const checkedAt = new Date().toISOString();
  const rows = results.map(r => ({
    domain: r.domain,
    name: r.name,
    tld: r.tld,
    status: r.status,
    source: opts.source,
    actor_id: opts.actorId ?? null,
    checked_at: checkedAt,
  }));
  try {
    const { error } = await fromTable(getAdminClient(), DATABASE_TABLES.DOMAIN_LOOKUPS).insert(
      rows
    );
    if (error) {
      logger.warn('domain lookup history not written', { error, count: rows.length }, 'Domains');
    }
  } catch (err) {
    logger.warn('domain lookup history not written', { err, count: rows.length }, 'Domains');
  }
}
