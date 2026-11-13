/**
 * GET /api/og/post/[id] — the share card for a wall post: who wrote it and
 * its first words, on the same card as every listing.
 *
 * A post used to share with no image at all (`twitter:card=summary`), so
 * WhatsApp showed a bare text box and LinkedIn its grey placeholder. Only a
 * public post is drawn (post-card-data.ts); any other id gets the brand card.
 */

import { loadPostCard } from '@/lib/og/post-card-data';
import { brandOnlyCard } from '@/lib/og/project-card';
import { shareCardResponse } from '@/lib/og/share-card';
import { createPublicClient } from '@/lib/supabase/public';

// Must be a string literal — Next.js static-analyzes `runtime` at build time.
export const runtime = 'nodejs';
export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  // A failed read is a brand card, never a broken image in someone's chat.
  const card = await Promise.resolve()
    .then(() => loadPostCard(createPublicClient(), id))
    .catch(() => null);
  return card ? shareCardResponse(card) : brandOnlyCard();
}
