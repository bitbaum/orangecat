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

/**
 * The rule above, in words — what /faq ("Who can see my activity?") and /docs
 * ("Visibility control") tell a reader. Both used to promise every entity a
 * public / followers-only / private setting; listings only have "Show on
 * Public Profile", and that three-way choice belongs to posts and articles
 * (TIMELINE_VISIBILITY_OPTIONS). content/faq.md takes it as
 * {{ENTITY_VISIBILITY_SUMMARY}}.
 */
export const ENTITY_VISIBILITY_SUMMARY =
  'While a project, product, service or other listing is a draft, only you can see it. Once you publish it, it is public: anyone can open it, and you choose whether it also appears on your profile. Some kinds, such as loans, bots, wishlists, circles and organizations, have their own visibility setting. Posts and articles can be public, followers-only or private.';
