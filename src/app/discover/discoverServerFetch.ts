/**
 * Server-side fetch for the /discover SEO surface.
 *
 * /discover is an interactive client app, so its live results are invisible to
 * search engines and AI crawlers (they don't run the client fetch). This gives
 * the page a small block of REAL server-rendered content: the most recently
 * published public entities, linking to their already-SSR'd detail pages — so
 * crawlers see genuine content + deep links on /discover instead of an empty
 * shell. It complements the sitemap (which enumerates every entity URL).
 *
 * Admin client + explicit public-status filters (same pattern as sitemap.ts):
 * no cookies → the page can be ISR-cached; the filters guarantee only
 * publicly-visible rows are returned.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { withoutFixtureTitles } from '@/config/public-directory';
import { getTableName, ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';

export interface FeaturedEntity {
  id: string;
  title: string;
  description: string | null;
  typeLabel: string;
  href: string;
}

/** High-signal types whose public rows use a `title`/`description`/`status` shape. */
const SOURCES: { type: EntityType; statuses: string[] }[] = [
  { type: 'service', statuses: [STATUS.SERVICES.ACTIVE] },
  { type: 'product', statuses: [STATUS.PRODUCTS.ACTIVE] },
  { type: 'cause', statuses: [STATUS.CAUSES.ACTIVE] },
  { type: 'event', statuses: [STATUS.EVENTS.PUBLISHED, STATUS.EVENTS.OPEN, STATUS.EVENTS.ONGOING] },
];

const PER_TYPE = 3;
const TOTAL = 12;

interface Row {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

/**
 * Latest public entities across a few high-signal types, newest first, capped
 * at {@link TOTAL}. Never throws — returns [] on any failure so the page still
 * renders (the interactive client app is the real experience).
 */
export async function fetchDiscoverFeatured(): Promise<FeaturedEntity[]> {
  try {
    const supabase = createAdminClient();

    const perType = await Promise.all(
      SOURCES.map(async ({ type, statuses }) => {
        const { data } = (await withoutFixtureTitles(
          supabase
            .from(getTableName(type))
            .select('id, title, description, created_at')
            .in('status', statuses)
        )
          .order('created_at', { ascending: false })
          .limit(PER_TYPE)) as { data: Row[] | null };

        const meta = ENTITY_REGISTRY[type];
        return (data ?? []).map((row): FeaturedEntity & { created_at: string } => ({
          id: row.id,
          title: row.title,
          description: row.description,
          typeLabel: meta.name,
          href: `${meta.publicBasePath}/${row.id}`,
          created_at: row.created_at,
        }));
      })
    );

    return perType
      .flat()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, TOTAL)
      .map(({ created_at: _created_at, ...e }) => e);
  } catch (error) {
    logger.error('fetchDiscoverFeatured failed', error, 'Discover');
    return [];
  }
}
