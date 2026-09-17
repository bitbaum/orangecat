/**
 * The shape every timeline feed answers in.
 *
 * Six feed functions (user, followed, enriched, profile, project, community)
 * each spelled out the same three things by hand: the page window, the success
 * envelope, and — twice per function, once for "no rows" and once for the
 * catch — the empty envelope. That is the same twenty-line object literal
 * written out fourteen times, and it is why userFeeds.ts alone carried nine
 * clones. A field added to TimelineFeedResponse had to be remembered in all
 * fourteen; the feeds that forgot it would still compile.
 *
 * What differs between the feeds is which rows they fetch. That stays in each
 * file. This is only the envelope.
 */

import type {
  TimelineDisplayEvent,
  TimelineFeedResponse,
  TimelineFilters,
  TimelinePagination,
} from '@/types/timeline';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants';
import { buildDefaultFilters } from '@/services/timeline/formatters/filters';

/**
 * The requested slice: page number, clamped page size, and the row offset.
 * `limit` is clamped to MAX_PAGE_SIZE — a caller cannot ask for the table.
 */
export function pageWindow(pagination?: Partial<TimelinePagination>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = pagination?.page || 1;
  const limit = Math.min(pagination?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, limit, offset: (page - 1) * limit };
}

/** A feed that has rows. `total` is the row count the query reported. */
export function feedResponse(
  events: TimelineDisplayEvent[],
  window: { page: number; limit: number },
  total: number,
  filters?: Partial<TimelineFilters>
): TimelineFeedResponse {
  return {
    events,
    pagination: {
      page: window.page,
      limit: window.limit,
      total,
      hasNext: (window.page - 1) * window.limit + window.limit < total,
      hasPrev: window.page > 1,
    },
    filters: buildDefaultFilters(filters),
    metadata: {
      totalEvents: total,
      featuredEvents: events.filter(e => e.isFeatured).length,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * A feed with nothing in it. Every feed here returns this rather than throwing
 * — a failed query is logged and the surface renders empty, because a timeline
 * that cannot load is not a reason to take the page down.
 *
 * Pass `pagination` to echo back what the caller asked for; omit it to report
 * the first page, which is what the feeds that never got as far as reading
 * their arguments do.
 */
export function emptyFeed(
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): TimelineFeedResponse {
  return {
    events: [],
    pagination: {
      page: pagination?.page || 1,
      // Deliberately NOT clamped by MAX_PAGE_SIZE: this echoes the request
      // back, and there are no rows for it to bound.
      limit: pagination?.limit || DEFAULT_PAGE_SIZE,
      total: 0,
      hasNext: false,
      hasPrev: false,
    },
    filters: buildDefaultFilters(filters),
    metadata: {
      totalEvents: 0,
      featuredEvents: 0,
      lastUpdated: new Date().toISOString(),
    },
  };
}
