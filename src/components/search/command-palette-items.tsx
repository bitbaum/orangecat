/**
 * What the command palette can find, and how it is ranked.
 *
 * Every list is DERIVED: pages from the sidebar's sections, "create" from the
 * entity registry's plain copy, your things from /api/things. It used to be
 * two hand-typed arrays — ten create links and eight pages — that had already
 * drifted: no organisations, circles, research, companions or "Your money",
 * and no way to find something you had made.
 *
 * Ranking is listkit's: every word must match in any order, accents fold
 * ("zurich" finds "Zürich"), and a hit in the label beats a hit in a keyword.
 */
import type { ComponentType } from 'react';
import { User } from 'lucide-react';
import { applyQuery, emptyQuery, type ListSpec } from 'listkit';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { sidebarSections, type NavigationItem } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import type { Thing } from '@/domain/things/service';
import type { GlobalSearchHit } from '@/services/search';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  /** Extra words that should find this item but are not shown. */
  keywords?: string;
  href: string;
}

/**
 * Public page for a global-search hit. Entity types come from the registry —
 * every type global_search returns has a `publicBasePath` keyed by id — so a
 * type added to the RPC links correctly without a new case here. Two keys are
 * not the id: a profile's username and a group's slug, both sent as
 * `path_key` (a profile also carries "@username" in its subtitle, the older
 * channel, kept as the fallback).
 */
export function hrefForHit(hit: GlobalSearchHit): string {
  if (hit.entity_type === 'profile') {
    const username = hit.path_key || (hit.subtitle ?? '').replace(/^@/, '');
    return ROUTES.PROFILES.VIEW(username || hit.id);
  }
  if (hit.entity_type === 'group') {
    return hit.path_key ? ROUTES.GROUPS.VIEW(hit.path_key) : ROUTES.GROUPS.LIST;
  }
  const meta = (ENTITY_REGISTRY as Partial<Record<string, { publicBasePath: string }>>)[
    hit.entity_type
  ];
  return meta ? `${meta.publicBasePath}/${hit.id}` : ROUTES.DISCOVER;
}

/** Icon for a global-search hit: the registry's, else the person icon for a profile. */
export function iconForHit(hit: GlobalSearchHit): PaletteItem['icon'] {
  const meta = (ENTITY_REGISTRY as Partial<Record<string, { icon: PaletteItem['icon'] }>>)[
    hit.entity_type
  ];
  return meta?.icon ?? User;
}

/** "Sell something", "Raise money for a goal" … one per entity type, from the registry. */
export function buildCreateItems(): PaletteItem[] {
  return ENTITY_TYPES.map(type => {
    const meta = ENTITY_REGISTRY[type];
    return {
      id: `create-${type}`,
      label: meta.plain.verb,
      hint: meta.plain.what,
      icon: meta.icon,
      keywords: `create new ${meta.name} ${meta.namePlural} ${meta.plain.example}`,
      href: meta.createPath,
    };
  });
}

function flatten(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap(item => [item, ...flatten(item.children ?? [])]);
}

/** Every page in the sidebar, plus each entity type's own list. */
export function buildPages(): PaletteItem[] {
  const seen = new Set<string>();
  const out: PaletteItem[] = [];
  const add = (item: PaletteItem) => {
    if (seen.has(item.href)) {
      return;
    }
    seen.add(item.href);
    out.push(item);
  };
  for (const section of sidebarSections) {
    for (const item of flatten(section.items)) {
      if (!item.href || item.external || item.comingSoon || !item.icon) {
        continue;
      }
      add({
        id: `page-${item.href}`,
        label: item.name,
        hint: item.description,
        icon: item.icon as PaletteItem['icon'],
        keywords: section.title,
        href: item.href,
      });
    }
  }
  for (const type of ENTITY_TYPES) {
    const meta = ENTITY_REGISTRY[type];
    add({
      id: `page-${meta.basePath}`,
      label: `Your ${meta.namePlural.toLowerCase()}`,
      icon: meta.icon,
      keywords: `${meta.name} ${meta.namePlural} my list manage`,
      href: meta.basePath,
    });
  }
  return out;
}

/** Your own things, as palette rows. */
export function thingItems(things: Thing[]): PaletteItem[] {
  return things.map(thing => {
    const meta = ENTITY_REGISTRY[thing.type];
    return {
      id: `thing-${thing.type}-${thing.id}`,
      label: thing.title,
      hint: thing.status ? `${meta.name} · ${thing.status}` : meta.name,
      icon: meta.icon,
      keywords: meta.namePlural,
      href: thing.href,
    };
  });
}

/** Label first, so a word in the label outranks the same word in a keyword. */
const PALETTE_SPEC: ListSpec<PaletteItem> = {
  facets: [],
  search: { text: item => [item.label, item.hint, item.keywords] },
  sorts: [{ key: 'given', by: [] }],
  defaultSort: 'given',
};

/**
 * The best `limit` items for what was typed, best first. With nothing typed,
 * the first `limit` in their given order — the sidebar's order is a decision.
 */
export function rankItems(items: PaletteItem[], typed: string, limit: number): PaletteItem[] {
  const query = { ...emptyQuery(PALETTE_SPEC), q: typed.trim(), pageSize: limit };
  return applyQuery(items, PALETTE_SPEC, query).rows;
}
