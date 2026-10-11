import { toTile, type FleetTile } from '@/components/ecosystem/studio-fleet';
import { fetchStudioMapForCat } from '@/services/ai/studio-map-fetcher';

/**
 * "Is this OrangeCat project one of the studio's own products?"
 *
 * The fleet map records, for every project Loki builds, the OrangeCat page
 * it is funded on. A project page that IS such a product should say so with
 * the product's face, its live door and when it last moved — the page used
 * to show a wall of text and a Bitcoin box, and nothing that made Loki's own
 * page on OrangeCat look like Loki.
 *
 * NEVER FAILS THE PAGE. The map is a neighbour's; absent or slow, this is
 * null and the page renders as it always did.
 */
export async function getStudioProject(projectId: string): Promise<FleetTile | null> {
  if (!projectId) {
    return null;
  }
  const map = await fetchStudioMapForCat();
  if (!map) {
    return null;
  }
  const suffix = `/projects/${projectId}`;
  const project = map.projects.find(p => {
    const own = p.urls.orangecat;
    if (!own) return false;
    try {
      return new URL(own).pathname.replace(/\/$/, '') === suffix;
    } catch {
      return false;
    }
  });
  return project ? toTile(project) : null;
}
