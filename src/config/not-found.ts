/**
 * The words of every "not found" page and tab title. One sentence shape for
 * every kind, with the kind's name read from the registry.
 *
 * There were three sets of words ("Page Not Found", "Project Not Found",
 * "Profile Not Found"), in Title Case, with buttons that said "Discover
 * Projects" whatever was missing, and /products/xyz carried the tab title
 * "Product Not Found" over the heading "Page Not Found" (system#9).
 */

import { DISCOVER_HERO, DISCOVER_ORDER, DISCOVER_TYPE_SLUGS } from '@/config/discover-tabs';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import type { EntityType } from '@/config/entity-registry';

/** What can be missing: a registry kind, a person's profile, or just a page. */
export type NotFoundKind = EntityType | 'profile' | 'page';

const PEOPLE = { name: 'Profile', namePlural: 'People' } as const;

function names(kind: Exclude<NotFoundKind, 'page'>): { name: string; namePlural: string } {
  return kind === 'profile' ? PEOPLE : ENTITY_REGISTRY[kind];
}

/** "This product isn't here" — the page's one heading. */
export function notFoundHeading(kind: NotFoundKind = 'page'): string {
  const noun = kind === 'page' ? 'page' : names(kind).name.toLowerCase();
  return `This ${noun} isn't here`;
}

/** "Product not found" — the tab title, for `generateMetadata`. */
export function notFoundTitle(kind: NotFoundKind = 'page'): string {
  return `${kind === 'page' ? 'Page' : names(kind).name} not found`;
}

/**
 * One sentence for every case. It does not say whether the thing ever
 * existed: a wallet's page must not confirm that an id once held a payment
 * destination, and nothing else gains from saying more.
 */
export const NOT_FOUND_MESSAGE = 'It may have been removed or made private, or the link is wrong.';

export const NOT_FOUND_SEARCH = {
  label: `Search ${DISCOVER_HERO.title}`,
  placeholder: DISCOVER_HERO.searchPlaceholder,
  action: ROUTES.DISCOVER,
} as const;

export interface NotFoundLink {
  href: string;
  label: string;
}

/**
 * Where to go instead. A kind that Discover lists leads to its own shelf
 * ("See all products"); anything else leads to Discover.
 */
export function notFoundBrowse(kind: NotFoundKind = 'page'): NotFoundLink {
  if (kind !== 'page' && DISCOVER_ORDER.includes(kind)) {
    return {
      href: ROUTES.DISCOVER_TYPE(DISCOVER_TYPE_SLUGS[kind]),
      label: `See all ${names(kind).namePlural.toLowerCase()}`,
    };
  }
  return { href: ROUTES.DISCOVER, label: DISCOVER_HERO.title };
}
