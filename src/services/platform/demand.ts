/**
 * Open-market demand — what the economy is asking for, exposed so the BUILD side
 * (Loki) can build for real need instead of guesses. Two signals:
 *   - needs:    public, active wishlists (their title/description + item detail)
 *   - searches: the terms people search for, as anonymous aggregates
 * Both are already-public data; safe to expose without a session.
 */
import { DATABASE_TABLES } from '@/config/database-tables';

export interface DemandNeed {
  id: string;
  title: string;
  /** The need, in the wisher's own words (wishlist + its items), capped. */
  text: string;
  url: string;
  createdAt: string | null;
}

export interface DemandSearch {
  term: string;
  count: number;
}

export interface OpenDemand {
  needs: DemandNeed[];
  searches: DemandSearch[];
}

const SEARCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function getOpenDemand(supabase: any, limit = 20): Promise<OpenDemand> {
  // Needs = public + active wishlists, newest first.
  const { data: wl } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .select('id, title, description, created_at')
    .eq('visibility', 'public')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  const wishlists = (wl ?? []) as Array<{
    id: string;
    title: string | null;
    description: string | null;
    created_at: string | null;
  }>;

  // The real need usually lives in the items — pull them in one bulk query.
  const itemsByWishlist = new Map<string, string[]>();
  const ids = wishlists.map(w => w.id);
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from(DATABASE_TABLES.WISHLIST_ITEMS)
      .select('wishlist_id, title, description')
      .in('wishlist_id', ids);
    for (const it of items ?? []) {
      const arr = itemsByWishlist.get(it.wishlist_id) ?? [];
      if (it.title) {
        arr.push(it.title);
      }
      if (it.description) {
        arr.push(it.description);
      }
      itemsByWishlist.set(it.wishlist_id, arr);
    }
  }

  const needs: DemandNeed[] = wishlists.map(w => {
    const parts = [w.title, w.description, ...(itemsByWishlist.get(w.id) ?? [])].filter(
      Boolean
    ) as string[];
    return {
      id: w.id,
      title: w.title || 'Wishlist',
      text: parts.join('. ').slice(0, 600),
      url: `/wishlists/${w.id}`,
      createdAt: w.created_at ?? null,
    };
  });

  // Searches = top recent query terms (anonymous — search_queries stores no
  // identity), aggregated by frequency.
  const since = new Date(Date.now() - SEARCH_WINDOW_MS).toISOString();
  const { data: rawq } = await supabase
    .from(DATABASE_TABLES.SEARCH_QUERIES)
    .select('query')
    .gte('created_at', since)
    .limit(500);
  const counts = new Map<string, number>();
  for (const r of rawq ?? []) {
    const q = (r.query ?? '').trim();
    if (q.length >= 3) {
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
  }
  const searches: DemandSearch[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));

  return { needs, searches };
}
