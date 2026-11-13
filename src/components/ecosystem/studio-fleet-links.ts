import { ECOSYSTEM } from '@/config/ecosystem';
import type { StudioMapSummary } from '@/services/ai/studio-map-fetcher';

/**
 * Loki's studio map names, for each product, the OrangeCat project page it is
 * funded on. That link is a neighbour's data: when the project is deleted or
 * not public, the tile that trusted it opened a 404 (the first "Live now"
 * tile, Bitbaum, did). These pure helpers let the caller check each such page
 * against the projects anyone can open, and drop the link that leads nowhere
 * so the tile falls back to the product's own site (`projectHref`).
 */

const PROJECT_PATH =
  /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

function sameHost(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '');
}

/** The project id in an OrangeCat `/projects/<id>` URL, else null. */
export function orangeCatProjectId(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (!sameHost(parsed, new URL(ECOSYSTEM.orangeCat.siteUrl))) {
      return null;
    }
    return PROJECT_PATH.exec(parsed.pathname)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Every OrangeCat project id the map links to, once each. */
export function linkedProjectIds(map: StudioMapSummary): string[] {
  const ids = new Set<string>();
  for (const project of map.projects) {
    const id = orangeCatProjectId(project.urls.orangecat);
    if (id) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * The map with every OrangeCat project link that is not in `openable`
 * removed. Links to other OrangeCat paths are left alone; only project pages
 * are checked, because only those come and go with the data.
 */
export function withoutDeadProjectLinks(
  map: StudioMapSummary,
  openable: ReadonlySet<string>
): StudioMapSummary {
  return {
    ...map,
    projects: map.projects.map(project => {
      const id = orangeCatProjectId(project.urls.orangecat);
      return id && !openable.has(id)
        ? { ...project, urls: { ...project.urls, orangecat: null } }
        : project;
    }),
  };
}
