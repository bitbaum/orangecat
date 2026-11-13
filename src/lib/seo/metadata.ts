import { Metadata } from 'next';
import { SITE_ORIGIN } from '@/config/site-origin';
import { APP_NAME } from '@/config/brand';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { OG_SIZE } from '@/lib/og/branding';
import { metaDescription } from '@/lib/og/share-line';

const BASE_URL = SITE_ORIGIN;

/**
 * The branded root card (src/app/opengraph-image.tsx). A page that sets its
 * own `openGraph` replaces the root's whole object — Next.js does not merge
 * it — so the file-based image is lost unless the page names one again.
 */
export const DEFAULT_SHARE_IMAGE = `${BASE_URL}/opengraph-image`;

/**
 * An entity's own share card (src/app/api/og/entity/[type]/[id]): its picture
 * or its kind's icon, title, maker and one figure. A draft or private item
 * renders the brand card there, so naming the URL leaks nothing.
 */
export function entityShareImage(type: EntityType, id: string): string {
  return `${BASE_URL}/api/og/entity/${type}/${encodeURIComponent(id)}`;
}

/**
 * Feed autodiscovery. `alternates` is replaced, not merged, too: a page that
 * sets a canonical URL must name the feed again or readers stop finding it.
 */
export const FEED_ALTERNATES = { 'application/rss+xml': `${BASE_URL}${ROUTES.RSS}` };

interface PageMetadataInput {
  /** The page's <title>; the root layout's template adds the site name. */
  title: string;
  /** What a share card is titled, on every network alike. Defaults to `title`. */
  shareTitle?: string;
  description?: string | null;
  /** What a share card says. Defaults to `description`. */
  shareDescription?: string | null;
  /** Site-relative path of the page, e.g. `ROUTES.PAY_LANDING`. */
  path: string;
  /** Absolute image URL. Defaults to the branded root card. */
  image?: string | null;
  /**
   * True when `image` is one of our generated 1200×630 cards: the tags then
   * carry its size and alt text, so previewers lay it out before fetching it.
   */
  imageIsCard?: boolean;
}

/**
 * A page's title, description, canonical URL and share card, in one shape:
 * og:* and twitter:* say the same words, every description is trimmed with
 * metaDescription(), and every card has an image.
 */
export function pageMetadata({
  title,
  shareTitle = title,
  description,
  shareDescription = description,
  path,
  image,
  imageIsCard = false,
}: PageMetadataInput): Metadata {
  const url = `${BASE_URL}${path}`;
  const desc = metaDescription(description ?? null);
  const shareDesc = metaDescription(shareDescription ?? null);
  const images =
    image && imageIsCard
      ? [{ url: image, ...OG_SIZE, alt: shareTitle }]
      : [image || DEFAULT_SHARE_IMAGE];

  return {
    title,
    description: desc,
    alternates: { canonical: url, types: FEED_ALTERNATES },
    openGraph: {
      title: shareTitle,
      description: shareDesc,
      images,
      url,
      type: 'website',
      siteName: APP_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDesc,
      images,
    },
  };
}

interface EntityMetadataInput {
  type: EntityType;
  id: string;
  title: string;
  description?: string | null;
}

/**
 * Generate Next.js Metadata for an entity page.
 * Derives canonical URL from ENTITY_REGISTRY publicBasePath (SSOT). The share
 * image is always the entity's own card, which draws its picture when it has
 * one: a bare cover photo said nothing about what or whose it was.
 */
export function generateEntityMetadata({
  type,
  id,
  title,
  description,
}: EntityMetadataInput): Metadata {
  return pageMetadata({
    title,
    description: description?.trim() || `${title} on ${APP_NAME} - Bitcoin-native marketplace.`,
    path: `${ENTITY_REGISTRY[type].publicBasePath}/${id}`,
    image: entityShareImage(type, id),
    imageIsCard: true,
  });
}
