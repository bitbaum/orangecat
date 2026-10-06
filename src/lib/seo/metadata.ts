import { Metadata } from 'next';
import { SITE_ORIGIN } from '@/config/site-origin';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';

const BASE_URL = SITE_ORIGIN;

interface EntityMetadataInput {
  type: EntityType;
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
}

/**
 * Generate Next.js Metadata for an entity page.
 * Derives canonical URL from ENTITY_REGISTRY publicBasePath (SSOT).
 */
export function generateEntityMetadata({
  type,
  id,
  title,
  description,
  imageUrl,
}: EntityMetadataInput): Metadata {
  const entityMeta = ENTITY_REGISTRY[type];
  const url = `${BASE_URL}${entityMeta.publicBasePath}/${id}`;
  const desc = description || `${title} on OrangeCat - Bitcoin-native marketplace.`;

  // Fallback to the branded root OG card (src/app/opengraph-image.tsx)
  // when an entity has no avatar/cover image. The previous hardcoded
  // `/images/og-default.png` pointed at a file that doesn't exist; every
  // share of a service/product/project/cause/loan/event/asset/investment/
  // research detail page emitted a 404 to social previewers.
  const image = imageUrl || `${BASE_URL}/opengraph-image`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      images: [image],
      url,
      type: 'website',
      siteName: 'OrangeCat',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [image],
    },
  };
}
