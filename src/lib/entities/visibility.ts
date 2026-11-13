/**
 * What "publicly visible" means for an entity row — one definition shared by
 * the public detail pages and the capital rails.
 *
 * Default: `status = active`. An array value means "any of these": an
 * investment is live as open, funded or active, and a filter that only knew
 * `active` 404'd every freshly published offering (publishing sets `open`).
 *
 * A list of rules means "all of these". A loan is public when its owner made
 * it so AND it is still active: `is_public` alone kept cancelled loans open to
 * strangers and in the sitemap while search and Discover hid them.
 */

import { STATUS } from '@/config/database-constants';

export type VisibilityRule = { column: string; value: string | boolean | readonly string[] };
export type VisibilityFilter = VisibilityRule | readonly VisibilityRule[];

const ACTIVE_STATUS_RULE: VisibilityRule = { column: 'status', value: STATUS.PRODUCTS.ACTIVE };

interface FilterableQuery {
  eq(column: string, value: unknown): unknown;
  in(column: string, values: readonly unknown[]): unknown;
}

function applyRule<Q extends FilterableQuery>(query: Q, { column, value }: VisibilityRule): Q {
  return (Array.isArray(value) ? query.in(column, value) : query.eq(column, value)) as Q;
}

/** Narrow a query to publicly visible rows. */
export function applyVisibility<Q extends FilterableQuery>(query: Q, filter?: VisibilityFilter): Q {
  const rules = filter ? ([] as VisibilityRule[]).concat(filter) : [ACTIVE_STATUS_RULE];
  return rules.reduce<Q>((q, rule) => applyRule(q, rule), query);
}
