import { DISCOVER_ORDER, DISCOVER_TYPE_SLUGS } from './discover-tabs';

/** The same supported public kinds across Discover, Cat, API and MCP. */
export const SEARCH_TYPES = [
  'all',
  ...DISCOVER_ORDER.map(type => DISCOVER_TYPE_SLUGS[type]),
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
