/**
 * Reading and writing an entity's cover picture — the column comes from
 * ENTITY_COVER (src/config/entity-cover.ts), never from the caller.
 */

import { ENTITY_COVER } from '@/config/entity-cover';
import type { EntityType } from '@/config/entity-registry';

type Row = Record<string, unknown>;

const urlsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );

/**
 * The entity's pictures, cover first, then its gallery, without repeats. The
 * first one is the hero on its page, the picture on its Discover card and on
 * its share card.
 */
export function entityCoverImages(type: EntityType, row: Row): string[] {
  const cover = ENTITY_COVER[type];
  if (!cover) {
    return [];
  }
  const all = [cover.field, ...(cover.gallery ?? [])].flatMap(column => urlsOf(row[column]));
  return [...new Set(all.map(url => url.trim()))];
}

/** The entity's cover, or null when it has no picture. */
export function entityCover(type: EntityType, row: Row): string | null {
  return entityCoverImages(type, row)[0] ?? null;
}

/**
 * The cover column for an insert: `...coverColumn('cause', input)`. Nothing
 * for a kind without a picture.
 */
export function coverColumn(type: EntityType, input: unknown): Record<string, string | null> {
  const field = ENTITY_COVER[type]?.field;
  if (!field) {
    return {};
  }
  const value = (input as Row | null | undefined)?.[field];
  return { [field]: typeof value === 'string' && value.trim() ? value.trim() : null };
}

/**
 * The cover column for an update payload builder. Removing the picture in the
 * form sends null, and that has to reach the row.
 */
export function coverFieldMapping(type: EntityType): { from: string; clearable: true }[] {
  const field = ENTITY_COVER[type]?.field;
  return field ? [{ from: field, clearable: true }] : [];
}
