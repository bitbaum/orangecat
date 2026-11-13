/**
 * What an entity's share card says, read the way a stranger would read it.
 *
 * The read goes through a SESSIONLESS client and the public page's own
 * visibility rule, so the card can only say what a signed-out visitor could
 * read on the page. A draft, a private companion, an inactive wishlist or an
 * id nobody has returns null and the route draws the plain brand card — never
 * the item's title, picture or price. (A signed-in owner opening the card URL
 * gets the brand card for their draft too: the card is cached publicly, so it
 * must never depend on who asked.)
 */

import { ENTITY_REGISTRY, getTableName, type EntityType } from '@/config/entity-registry';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';
import { INVESTMENT_PUBLIC_STATUSES } from '@/config/investments';
import { PUBLIC_VISIBILITY } from '@/config/public-visibility';
import { fetchEntityOwner } from '@/lib/entities/fetchEntityOwner';
import { applyVisibility, type VisibilityFilter } from '@/lib/entities/visibility';
import { iconNodeOf, loadCardImage, makerName } from '@/lib/og/card-parts';
import { entityCardFigure, entityCardImage } from '@/lib/og/entity-card-figure';
import { shareLine } from '@/lib/og/share-line';
import type { ShareCardProps } from '@/lib/og/share-card';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * The kinds whose public page is the generic entity page (their metadata comes
 * from generateEntityMetadata). Project, group and profile have cards of their
 * own; wallets and documents have no public page to share.
 */
export const ENTITY_CARD_TYPES = [
  'product',
  'service',
  'cause',
  'event',
  'loan',
  'investment',
  'asset',
  'research',
  'circle',
  'ai_assistant',
  'wishlist',
] as const satisfies readonly EntityType[];

export type EntityCardType = (typeof ENTITY_CARD_TYPES)[number];

export function isEntityCardType(value: string): value is EntityCardType {
  return (ENTITY_CARD_TYPES as readonly string[]).includes(value);
}

/**
 * Each kind's public rule — the same constants its detail page config uses
 * (PUBLIC_VISIBILITY, the event and investment status lists, the wishlist's
 * own switch); everything else is public when active.
 */
const CARD_VISIBILITY: Partial<Record<EntityCardType, VisibilityFilter>> = {
  ...PUBLIC_VISIBILITY,
  event: { column: 'status', value: EVENT_PUBLIC_STATUSES },
  investment: { column: 'status', value: INVESTMENT_PUBLIC_STATUSES },
  wishlist: [
    { column: 'is_active', value: true },
    { column: 'visibility', value: ['public', 'unlisted'] },
  ],
};

export function entityCardVisibility(type: EntityCardType): VisibilityFilter | undefined {
  return CARD_VISIBILITY[type];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The card for a public entity, or null for the brand card. */
export async function loadEntityCard(
  supabase: AnySupabaseClient,
  type: EntityCardType,
  id: string
): Promise<ShareCardProps | null> {
  if (!UUID.test(id)) {
    return null;
  }
  const query = supabase.from(getTableName(type)).select('*').eq('id', id);
  const { data } = await applyVisibility(query, entityCardVisibility(type)).maybeSingle();
  const row = data as Record<string, unknown> | null;
  if (!row || typeof row.title !== 'string' || !row.title.trim()) {
    return null;
  }

  const meta = ENTITY_REGISTRY[type];
  const [owner, figure, image] = await Promise.all([
    fetchEntityOwner(supabase, row).catch(() => null),
    entityCardFigure(type, row).catch(() => null),
    loadCardImage(entityCardImage(type, row)),
  ]);

  return {
    kicker: meta.name,
    title: row.title.trim(),
    maker: makerName(owner),
    figure,
    line: shareLine(typeof row.description === 'string' ? row.description : null),
    image,
    icon: iconNodeOf(meta.icon),
    roundFace: type === 'ai_assistant',
  };
}
