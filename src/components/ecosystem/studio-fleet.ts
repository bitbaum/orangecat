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
 * The home page's selection: the studio's own products that are live, the
 * three pillars first, then the rest by name. Client work and demos belong
 * to their owners and stay off the front page.
 */
export function selectHomeFleet(map: StudioMapSummary | null): FleetTile[] {
  if (!map) {
    return [];
  }
  return map.projects
    .filter(p => p.status === 'live' && STUDIO_LAYERS.includes(p.layer))
    .map(toTile)
    .sort(byLayerThenName);
}

/** Every project in the map, grouped by layer in the order the stack is told. */
export function groupFleetByLayer(map: StudioMapSummary | null): Array<{
  layer: string;
  tiles: FleetTile[];
}> {
  if (!map) {
    return [];
  }
  const groups = new Map<string, FleetTile[]>();
  for (const tile of map.projects.map(toTile).sort(byLayerThenName)) {
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
