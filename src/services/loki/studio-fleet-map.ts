import {
  linkedProjectIds,
  withoutDeadProjectLinks,
} from '@/components/ecosystem/studio-fleet-links';
import { getTableName } from '@/config/entity-registry';
import { createPublicClient } from '@/lib/supabase/public';
import { fetchStudioMapForCat, type StudioMapSummary } from '@/services/ai/studio-map-fetcher';
import { logger } from '@/utils/logger';

/**
 * The studio map as a public page may show it: every OrangeCat project link in
 * it checked against the projects a signed-out visitor can open (the same
 * anonymous RLS the project page reads through), and the dead ones dropped so
 * their tiles open the product's own site instead of a 404.
 *
 * Never fails the page: if the check itself fails, the links are dropped, not
 * trusted: the product's own site is always a page that exists.
 *
 * The result is kept for as long as the fetcher keeps the same map (it caches
 * for a few minutes), so the check is one small query per map, not per visitor.
 */
let checked: { source: StudioMapSummary; result: StudioMapSummary } | null = null;

export async function fetchStudioMapForPublicPage(): Promise<StudioMapSummary | null> {
  const map = await fetchStudioMapForCat();
  if (!map) {
    return null;
  }
  if (checked?.source === map) {
    return checked.result;
  }
  const ids = linkedProjectIds(map);
  if (ids.length === 0) {
    return map;
  }
  let openable: Set<string> = new Set();
  try {
    const { data, error } = await createPublicClient()
      .from(getTableName('project'))
      .select('id')
      .in('id', ids);
    if (error) {
      throw error;
    }
    openable = new Set((data ?? []).map(row => String((row as { id: string }).id).toLowerCase()));
  } catch (e) {
    logger.warn('studio map: project link check failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return withoutDeadProjectLinks(map, openable);
  }
  const result = withoutDeadProjectLinks(map, openable);
  checked = { source: map, result };
  return result;
}

/** Test seam: forget the checked map. */
export function resetStudioFleetMapCache(): void {
  checked = null;
}
