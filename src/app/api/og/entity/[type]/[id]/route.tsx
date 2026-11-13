/**
 * GET /api/og/entity/[type]/[id] — the share card for any public entity whose
 * page is the generic one (products, services, causes, events, loans,
 * investments, assets, research, circles, companions, wishlists).
 *
 * Eight of those kinds used to share as the site card ("OrangeCat — Your AI
 * economic agent"): a DJ sending his service page on WhatsApp sent an
 * OrangeCat ad. Now the card is the thing's own: its picture (else its kind's
 * icon from ENTITY_REGISTRY), its title, who made it, and the one figure that
 * matters (entity-card-figure.ts).
 *
 * Anything a stranger could not open — a draft, a private item, an unknown
 * type or id — gets the plain brand card, never its content.
 *
 * Node runtime: the image is fetched and checked before drawing
 * (loadCardImage), and amounts kept in BTC are converted with server rates.
 */

import { isEntityCardType, loadEntityCard } from '@/lib/og/entity-card-data';
import { brandOnlyCard } from '@/lib/og/project-card';
import { shareCardResponse } from '@/lib/og/share-card';
import { createPublicClient } from '@/lib/supabase/public';

// Must be a string literal — Next.js static-analyzes `runtime` at build time.
export const runtime = 'nodejs';
export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ type: string; id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { type, id } = await params;
  if (!isEntityCardType(type)) {
    return brandOnlyCard();
  }
  // A failed read is a brand card, never a broken image in someone's chat.
  const card = await Promise.resolve()
    .then(() => loadEntityCard(createPublicClient(), type, id))
    .catch(() => null);
  return card ? shareCardResponse(card) : brandOnlyCard();
}
