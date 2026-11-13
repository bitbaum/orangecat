/**
 * Which kind of thing the current page is about, for the Create sheet.
 *
 * The tab bar's plus used to change its name and its behaviour from page to
 * page: "Product" on the store, "Organization" on Groups, and on Messages it
 * opened the public post composer. It is now always "Create" and always opens
 * the sheet; the page you are on only puts its own kind first inside it.
 *
 * Uses ENTITY_REGISTRY as the single source of truth.
 */

import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';

// Most specific base path first, so a nested list wins over its parent.
const ROUTE_TO_ENTITY: ReadonlyArray<[string, EntityType]> = (
  Object.entries(ENTITY_REGISTRY) as Array<[EntityType, { basePath: string }]>
)
  .map(([type, meta]) => [meta.basePath, type] as [string, EntityType])
  .sort((a, b) => b[0].length - a[0].length);

/** The entity type whose list (or one of its pages) is open, if any. */
export function getContextualCreateType(pathname: string): EntityType | undefined {
  for (const [route, entityType] of ROUTE_TO_ENTITY) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return entityType;
    }
  }
  return undefined;
}
