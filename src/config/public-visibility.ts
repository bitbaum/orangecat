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

/**
 * The rule above, in words — what /faq ("Who can see my activity?") and /docs
 * ("Visibility control") tell a reader. Both used to promise every entity a
 * public / followers-only / private setting; listings only have "Show on
 * Public Profile", and that three-way choice belongs to posts and articles
 * (TIMELINE_VISIBILITY_OPTIONS). content/faq.md takes it as
 * {{ENTITY_VISIBILITY_SUMMARY}}.
 */
export const ENTITY_VISIBILITY_SUMMARY =
  'While a project, product, service or other listing is a draft, only you can see it. Once you publish it, it is public: anyone can open it, and you choose whether it also appears on your profile. Some kinds, such as loans, companions, wishlists, circles and groups, have their own visibility setting. Posts and articles can be public, followers-only or private.';
