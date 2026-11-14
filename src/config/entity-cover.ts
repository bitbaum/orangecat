/**
 * The one picture every kind of thing has.
 *
 * Each kind stores its cover in ONE column, named here and nowhere else. The
 * create and edit forms get their picture field from this map
 * (base-config-factory), the public page's hero, the Discover card, search
 * results and the share card all read it through `entityCoverImages`, and the
 * API writes it through `coverColumn` / `coverFieldMapping`
 * (src/lib/entities/cover.ts). `public_documents()` in the database reads the
 * same columns — change both together.
 *
 * The columns keep the names they already had (a product's `thumbnail_url`, an
 * event's `banner_url`): renaming a live column buys nothing a map does not.
 * Kinds that had no picture column got `cover_image_url`
 * (20261114093700_a_picture_for_every_kind.sql).
 *
 * `Record<EntityType, …>` on purpose: a new kind has to answer the question.
 */

import type { EntityType } from '@/config/entity-registry';

export interface EntityCover {
  /** The column that holds the cover's public URL. */
  field: string;
  /** What the form calls it. */
  label: string;
  /**
   * Older picture columns, read after the cover: they fill the hero's
   * thumbnail row, and stand in as the cover for rows saved before the kind
   * had one. Each holds a URL or an array of URLs.
   */
  gallery?: readonly string[];
}

const COVER_LABEL = 'Cover picture';

export const ENTITY_COVER: Record<EntityType, EntityCover | null> = {
  // Kept private to their owner: no public page, no card, no picture.
  wallet: null,
  document: null,
  project: { field: 'cover_image_url', label: COVER_LABEL },
  product: { field: 'thumbnail_url', label: COVER_LABEL, gallery: ['images'] },
  service: { field: 'cover_image_url', label: COVER_LABEL, gallery: ['images'] },
  cause: { field: 'cover_image_url', label: COVER_LABEL },
  event: { field: 'banner_url', label: COVER_LABEL, gallery: ['thumbnail_url', 'images'] },
  loan: { field: 'cover_image_url', label: COVER_LABEL },
  investment: { field: 'thumbnail_url', label: COVER_LABEL },
  asset: { field: 'cover_image_url', label: COVER_LABEL },
  research: { field: 'cover_image_url', label: COVER_LABEL },
  wishlist: { field: 'cover_image_url', label: COVER_LABEL },
  circle: { field: 'cover_image_url', label: COVER_LABEL },
  // A group and a bot are met by their face, not by a wide cover.
  group: { field: 'avatar_url', label: 'Picture', gallery: ['banner_url'] },
  ai_assistant: { field: 'avatar_url', label: 'Picture' },
};

/** The cover column of a kind, or null when the kind has no picture. */
export function coverFieldOf(type: EntityType): string | null {
  return ENTITY_COVER[type]?.field ?? null;
}
