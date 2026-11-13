import type { EntityType } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import type { VisibilityFilter } from '@/lib/entities/visibility';

/**
 * Which rows of an entity type a STRANGER may see — the one rule shared by the
 * public detail page (PublicEntityDetailPage) and the sitemap.
 *
 * Types not listed here are public when `status` is active. The ones listed
 * have their own switch: a companion or a loan can be active and still
 * private. The sitemap used to apply the status rule to every type, so it
 * handed search engines private companions whose pages answer 404 to anyone
 * but their owner (found on orangecat.ch, 2026-10-03: /companions/0af443fc…).
 *
 * A loan's switch is added to the status rule, not swapped for it: with
 * `is_public` alone, cancelled loans stayed open to strangers and listed in the
 * sitemap while search and Discover hid them (orangecat.ch, 2026-11-12).
 */
export const PUBLIC_VISIBILITY: Partial<Record<EntityType, VisibilityFilter>> = {
  ai_assistant: { column: 'is_public', value: true },
  loan: [
    { column: 'is_public', value: true },
    { column: 'status', value: STATUS.LOANS.ACTIVE },
  ],
};
