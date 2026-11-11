/**
 * Entity primary actions (SSOT)
 *
 * Every entity is different, but each has exactly ONE primary action a visitor
 * should take on its detail page — its economic verb, from the entity economic
 * taxonomy (see AGENTS.md). That per-entity difference lives here, in one
 * place, so detail pages stay generic and adding/retuning an entity touches config,
 * not page code.
 */

import type { EntityType } from '@/config/entity-registry';

export const ENTITY_PRIMARY_CTA: Record<EntityType, string> = {
  // Exchange — market transaction
  product: 'Buy now',
  service: 'Book this service',
  // Funding (no strings) — donation/gift.
  // "Donate" is deliberately not used: it frames the giver as a charity case's
  // benefactor rather than a backer, and it is the one word on this page that
  // disagreed with the panel it scrolls to ("Support with Bitcoin").
  cause: 'Fund this cause',
  research: 'Fund this research',
  wishlist: 'Gift an item',
  // Funding (soft strings) — milestone accountability
  project: 'Fund this project',
  // Lending / Investing
  loan: 'Review & lend',
  investment: 'Review & invest',
  // Assets
  asset: 'Rent or buy',
  // Time-bound coordination
  event: 'RSVP',
  // AI services
  ai_assistant: 'Chat',
  // Governance / community
  group: 'Join',
  circle: 'Join',
  // Cat context / wallets (no public transaction verb)
  document: 'View',
  wallet: 'Send',
};

/** The primary-action label for an entity type. */
export function getEntityPrimaryCta(type: EntityType): string {
  return ENTITY_PRIMARY_CTA[type] ?? 'View';
}
