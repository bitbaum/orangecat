import { ECOSYSTEM, ECOSYSTEM_PILLARS, type EcosystemPillar } from '@/config/ecosystem';
import type { StudioMapProject, StudioMapSummary } from '@/services/ai/studio-map-fetcher';

/**
 * Pure helpers for presenting the studio's fleet — what the map calls a
 * project, turned into what a tile shows. No fetching, no JSX, so the
 * selection and ordering rules have tests.
 */

/** Layers that are products of the studio, as opposed to client work or demos. */
export const STUDIO_LAYERS: readonly string[] = ['economic', 'execution', 'governance', 'product'];

const PILLAR_BY_SLUG: Record<string, EcosystemPillar['key']> = {
  orangecat: 'orangecat',
  loki: 'loki',
  solon: 'solon',
};

const LAYER_ORDER: Record<string, number> = {
  economic: 0,
  execution: 1,
  governance: 2,
  product: 3,
  client: 4,
  demo: 5,
  next: 6,
};

export interface FleetTile {
  slug: string;
  /** The pillar this project IS, when it is one of the three. */
  pillar: EcosystemPillar['key'] | null;
  name: string;
  what: string | null;
  layer: string;
  status: string;
  live: boolean;
  /** Same-origin path when the project has a page here, else its live site. */
  href: string | null;
  external: boolean;
  /** The product itself, when it is live somewhere — its own door, not a page about it. */
  liveUrl: string | null;
  /** When the project last moved, as the map records it (YYYY-MM-DD). */
  lastMovedOn: string | null;
}

/** "surf-your-life" → "Surf your life". Pillars keep their product name. */
export function displayName(project: Pick<StudioMapProject, 'slug' | 'name'>): string {
  const pillar = PILLAR_BY_SLUG[project.slug];
  if (pillar) {
    return ECOSYSTEM_PILLARS.find(p => p.key === pillar)?.title ?? project.name;
  }
  const words = project.name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Where a tile goes. A project with a page on OrangeCat links there as a
 * same-origin path (so the link survives a domain or env change); otherwise
 * its live site, opened in a new tab.
 */
export function projectHref(project: Pick<StudioMapProject, 'urls'>): {
  href: string | null;
  external: boolean;
} {
  const own = project.urls.orangecat;
  if (own) {
    try {
      const url = new URL(own);
      const self = new URL(ECOSYSTEM.orangeCat.siteUrl);
      if (url.hostname.replace(/^www\./, '') === self.hostname.replace(/^www\./, '')) {
        return { href: `${url.pathname}${url.search}`, external: false };
      }
    } catch {
      // fall through to the live site
    }
  }
  return project.urls.live
    ? { href: project.urls.live, external: true }
    : { href: null, external: false };
}

export function toTile(project: StudioMapProject): FleetTile {
  const { href, external } = projectHref(project);
  return {
    slug: project.slug,
    pillar: PILLAR_BY_SLUG[project.slug] ?? null,
    name: displayName(project),
    what: project.what,
    layer: project.layer,
    status: project.status,
    live: project.status === 'live',
    href,
    external,
    liveUrl: project.urls.live,
    lastMovedOn: project.now?.lastLog?.date ?? null,
  };
}

function byLayerThenName(a: FleetTile, b: FleetTile): number {
  const layer = (LAYER_ORDER[a.layer] ?? 99) - (LAYER_ORDER[b.layer] ?? 99);
  return layer !== 0 ? layer : a.name.localeCompare(b.name, 'en');
}

/**
 * Whether a project can stand on a public page as a product: it is live, and
 * the map says what it is. A tile with no line under its name read as a
 * scratch entry, and was one more often than not.
 */
function isPresentable(project: StudioMapProject): boolean {
  return project.status === 'live' && !!project.what?.trim();
}

/**
 * The home page's selection: the studio's own products that are live, the
 * three pillars first, then the rest by name. Client work and demos belong
 * to their owners and stay off the front page.
 */
export function selectHomeFleet(map: StudioMapSummary | null): FleetTile[] {
  if (!map) {
    return [];
  }
  return map.projects
    .filter(p => isPresentable(p) && STUDIO_LAYERS.includes(p.layer))
    .map(toTile)
    .sort(byLayerThenName);
}

/** How many products the home page shows before "All N live products". */
export const HOME_FLEET_PREVIEW = 6;

/**
 * The home page's grid: the pillars already have their own row above it, so
 * the grid shows the products built on them, a handful only. Every live tile
 * on a phone was about 4,100px of scrolling; the rest are one link away.
 */
export function homeFleetPreview(tiles: readonly FleetTile[]): FleetTile[] {
  return tiles.filter(tile => !tile.pillar).slice(0, HOME_FLEET_PREVIEW);
}

/** Layers /ecosystem shows: the studio's products and the client work on the stack. */
const STACK_PAGE_LAYERS: readonly string[] = [...STUDIO_LAYERS, 'client'];

/**
 * What /ecosystem shows, grouped by layer in the order the stack is told:
 * live projects with a line saying what they are. It used to be every entry
 * in the map — prospects, demos and "next" ideas, named by sentence-casing
 * their slug, some with no description and no link — published as products.
 */
export function groupFleetByLayer(map: StudioMapSummary | null): Array<{
  layer: string;
  tiles: FleetTile[];
}> {
  if (!map) {
    return [];
  }
  const groups = new Map<string, FleetTile[]>();
  const shown = map.projects.filter(p => isPresentable(p) && STACK_PAGE_LAYERS.includes(p.layer));
  for (const tile of shown.map(toTile).sort(byLayerThenName)) {
    const list = groups.get(tile.layer) ?? [];
    list.push(tile);
    groups.set(tile.layer, list);
  }
  return Array.from(groups, ([layer, tiles]) => ({ layer, tiles }));
}

/** The label a layer gets on a tile. */
export const LAYER_LABELS: Record<string, string> = {
  economic: 'Economy',
  execution: 'Execution',
  governance: 'Governance',
  product: 'Product',
  client: 'Client',
  demo: 'Demo',
  next: 'Next',
};
