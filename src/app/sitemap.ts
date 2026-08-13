import { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_STATUS } from '@/config/database-constants';
import { publicProfilePath } from '@/config/public-profile-path';

const BASE_URL = 'https://orangecat.ch';

interface SitemapProfile {
  username: string | null;
  updated_at: string | null;
}

interface SitemapEntity {
  id: string;
  updated_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    {
      url: `${BASE_URL}/discover`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/events`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/loans`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/groups`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/study-bitcoin`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/auth`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  let dynamicPages: MetadataRoute.Sitemap = [];

  try {
    // The sitemap walks every entity table by registry name, so the table is a
    // runtime value; each result is cast to the tiny shape this file needs.
    const supabase = looseClient(createAdminClient());

    // Public profile pages
    const { data: profiles } = (await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, updated_at')
      .not('username', 'is', null)) as { data: SitemapProfile[] | null };

    if (profiles) {
      const profilePages: MetadataRoute.Sitemap = profiles
        .filter((p): p is SitemapProfile & { username: string } => p.username !== null)
        .map(profile => ({
          // encodeURIComponent: usernames containing '@' (we observed
          // literal webdev@example.com profiles live) produce invalid
          // <loc> entries in some sitemap consumers and broken
          // crawl URLs. Same fix shape as the profile page canonical.
          url: `${BASE_URL}${publicProfilePath(profile.username)}`,
          lastModified: profile.updated_at ? new Date(profile.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
      dynamicPages = [...dynamicPages, ...profilePages];
    }

    // Public entity pages (active projects, products, services, etc.).
    // Standard entities use a `status` enum and ship in this loop.
    const SITEMAP_ENTITY_TYPES: EntityType[] = [
      'project',
      'product',
      'service',
      'cause',
      'loan',
      'event',
      'asset',
      'ai_assistant',
      'research',
      'investment',
    ];
    const entityTables = SITEMAP_ENTITY_TYPES.map(type => ({
      table: ENTITY_REGISTRY[type].tableName,
      publicBasePath: ENTITY_REGISTRY[type].publicBasePath,
    }));

    for (const { table, publicBasePath } of entityTables) {
      const { data: entities } = (await supabase
        .from(table)
        .select('id, updated_at')
        .eq('status', ENTITY_STATUS.ACTIVE)) as { data: SitemapEntity[] | null };

      if (entities) {
        const entityPages: MetadataRoute.Sitemap = entities.map(entity => ({
          url: `${BASE_URL}${publicBasePath}/${entity.id}`,
          lastModified: entity.updated_at ? new Date(entity.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
        dynamicPages = [...dynamicPages, ...entityPages];
      }
    }

    // Wishlists use is_active + visibility instead of a status enum, so they
    // need their own query. Publishing semantics: a wishlist is public when
    // it's been activated AND the owner chose public visibility (defaults
    // to private — see c9897f9a). Filter matches what the wishlist domain
    // service treats as crawler-visible.
    const wishlistMeta = ENTITY_REGISTRY['wishlist'];
    const { data: wishlists } = (await supabase
      .from(wishlistMeta.tableName)
      .select('id, updated_at')
      .eq('is_active', true)
      .eq('visibility', 'public')) as { data: SitemapEntity[] | null };

    if (wishlists) {
      const wishlistPages: MetadataRoute.Sitemap = wishlists.map(wishlist => ({
        url: `${BASE_URL}${wishlistMeta.publicBasePath}/${wishlist.id}`,
        lastModified: wishlist.updated_at ? new Date(wishlist.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      dynamicPages = [...dynamicPages, ...wishlistPages];
    }
  } catch {
    // If DB query fails, return static pages only — sitemap should never break the build
  }

  return [...staticPages, ...dynamicPages];
}
