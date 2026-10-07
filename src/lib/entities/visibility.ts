/**
 * What "publicly visible" means for an entity row — one definition shared by
 * the public detail pages and the capital rails.
 *
 * Default: `status = active`. An array value means "any of these": an
 * investment is live as open, funded or active, and a filter that only knew
 * `active` 404'd every freshly published offering (publishing sets `open`).
 */

import { STATUS } from '@/config/database-constants';

export type VisibilityFilter = { column: string; value: string | boolean | readonly string[] };

interface FilterableQuery {
  eq(column: string, value: unknown): unknown;
  in(column: string, values: readonly unknown[]): unknown;
}

/** Narrow a query to publicly visible rows. */
export function applyVisibility<Q extends FilterableQuery>(query: Q, filter?: VisibilityFilter): Q {
  const column = filter?.column ?? 'status';
  const value = filter?.value ?? STATUS.PRODUCTS.ACTIVE;
  return (Array.isArray(value) ? query.in(column, value) : query.eq(column, value)) as Q;
}
