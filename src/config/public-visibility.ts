import type { EntityType } from '@/config/entity-registry';

/**
 * Which rows of an entity type a STRANGER may see — the one rule shared by the
 * public detail page (PublicEntityDetailPage) and the sitemap.
 *
 * Types not listed here are public when `status` is active. The ones listed
 * have their own switch: a companion or a loan can be active and still
 * private. The sitemap used to apply the status rule to every type, so it
 * handed search engines private companions whose pages answer 404 to anyone
 * but their owner (found on orangecat.ch, 2026-10-03: /companions/0af443fc…).
 */
export interface PublicVisibilityFilter {
  column: string;
  value: string | boolean;
}

export const PUBLIC_VISIBILITY: Partial<Record<EntityType, PublicVisibilityFilter>> = {
  ai_assistant: { column: 'is_public', value: true },
  loan: { column: 'is_public', value: true },
};
