/**
 * What the command palette can find, and how it is ranked.
 *
 * Every list is DERIVED: pages from the sidebar's sections, "create" from the
 * entity registry's plain copy, your things from /api/things. It used to be
 * two hand-typed arrays — ten create links and eight pages — that had already
 * drifted: no organisations, circles, research, companions or "Your money",
 * and no way to find something you had made.
 *
 * Ranking is @bitbaum/searchkit's: every word must match in any order, one
 * slip per word is forgiven from four letters ("setings" finds Settings),
 * accents fold ("zurich" finds "Zürich"), and a hit in the label beats a hit
 * in a keyword.
 */
import type { ComponentType } from 'react';
import { User } from 'lucide-react';
import { createSearch, type Range, type SearchSpec } from '@bitbaum/searchkit';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { sidebarSections, type NavigationItem } from '@/config/navigation';
import type { Thing } from '@/domain/things/service';
import type { PublicHit } from '@/services/search/public-search';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  /** Extra words that should find this item but are not shown. */
  keywords?: string;
  href: string;
}

/** Icon for a kind of result: the registry's, else the person icon for people. */
export function iconForType(type: string): PaletteItem['icon'] {
  const meta = (ENTITY_REGISTRY as Partial<Record<string, { icon: PaletteItem['icon'] }>>)[type];
  return meta?.icon ?? User;
}

/** What a group of results of one kind is called: "Projects", "People". */
export function typeHeading(type: string): string {
  const meta = (ENTITY_REGISTRY as Partial<Record<string, { namePlural: string }>>)[type];
  return meta?.namePlural ?? 'People';
}

/**
 * Results grouped by kind, groups ordered by their best hit — the engine
 * already ranked them, so the first group is the one most likely meant.
 */
export function groupHits<H extends PublicHit>(hits: H[]): Array<{ type: string; hits: H[] }> {
  const groups = new Map<string, H[]>();
  for (const hit of hits) {
    const list = groups.get(hit.type) ?? [];
    list.push(hit);
    groups.set(hit.type, list);
  }
  return Array.from(groups, ([type, list]) => ({ type, hits: list }));
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

/** A palette row as ranked: what matched, for marking. */
export interface RankedItem extends PaletteItem {
  labelRanges?: Range[];
  hintRanges?: Range[];
  /** Typos it took to match what was typed. */
  typos?: number;
}

const PALETTE_FIELDS: SearchSpec<PaletteItem> = {
  // Label first, so a word in the label outranks the same word in a keyword.
  fields: [
    { name: 'label', get: item => item.label },
    { name: 'hint', get: item => item.hint },
    { name: 'keywords', get: item => item.keywords },
  ],
};

/**
 * The best `limit` items for what was typed, best first — typo-tolerant
 * (@bitbaum/searchkit: "setings" finds Settings). With nothing typed, the
 * first `limit` in their given order — the sidebar's order is a decision.
 */
export function rankItems(items: PaletteItem[], typed: string, limit: number): RankedItem[] {
  if (!typed.trim()) {
    return items.slice(0, limit);
  }
  // A palette row is found by what was typed or not at all: a word that
  // matches nothing must not be quietly dropped to find SOMETHING.
  return createSearch(items, PALETTE_FIELDS)
    .search(typed, { limit, relax: false })
    .map(hit => ({
      ...hit.item,
      labelRanges: hit.matches.label,
      hintRanges: hit.matches.hint,
      typos: hit.typos,
    }));
}

/**
 * Whether a page found by the typed words should sit above everyone's
 * results: when it matched with no more typos than the best of them, or they
 * matched only somewhere the reader cannot see. Enter takes the first row, so
 * "setings" must open Settings, not a listing that mentions settings.
 */
export function pagesFirst(
  pages: RankedItem[],
  hits: ReadonlyArray<{ typos: number | null }>
): boolean {
  const page = pages[0];
  if (!page) {
    return false;
  }
  const best = hits[0];
  return !best || best.typos === null || (page.typos ?? 0) <= best.typos;
}
