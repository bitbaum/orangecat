/**
 * Index SOURCES — which rows are eligible for the search corpus, and how their
 * embeddable text is built.
 *
 * Split from reindexService.ts (500-line service limit) along a real seam:
 * this module answers "what is indexable and what text represents it",
 * reindexService answers "reconcile the index with that".
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_STATUS } from '@/config/database-constants';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { clamp01, recency, isVerified, profileQuality, causeQuality } from './reindex-scoring';
import { publicProfilePath } from '@/config/public-profile-path';

export interface IndexItem {
  entity_type: string;
  entity_id: string;
  title: string;
  url: string;
  text: string;
  /** 0–1 outcome/quality signal, blended into ranking (secondary to relevance). */
  quality: number;
  updated_at: string | null;
}

/**
 * A wishlist's "need" text = its own title/description PLUS its items' — the
 * real demand detail usually lives in the items, not the thin container. This
 * is what gets embedded so a need can be matched to the supply that meets it.
 */
export async function buildWishlistText(
  supabase: any,
  w: { id: string; title?: string | null; description?: string | null }
): Promise<string> {
  const parts: string[] = [w.title, w.description].filter(Boolean) as string[];
  const { data: items } = await supabase
    .from(DATABASE_TABLES.WISHLIST_ITEMS)
    .select('title, description')
    .eq('wishlist_id', w.id)
    .limit(50);
  for (const it of items ?? []) {
    if (it.title) {
      parts.push(it.title);
    }
    if (it.description) {
      parts.push(it.description);
    }
  }
  return parts.join('. ').trim();
}

/** Entity types whose public rows are embedded into the search corpus.
 *  The allow-list is a deliberate scope decision; table + path come from the registry SSOT. */
export const INDEXABLE_ENTITY_TYPES = [
  'product',
  'service',
  'cause',
  // Projects are the "what's being built" side — including work published from
  // FleetCrown. Same generic branch (title + description, gated on status=active,
  // url /projects/:id), so a buyer searching by meaning ("someone building a
  // Bitcoin invoicing tool") hits the project, not just an exact keyword.
  'project',
] as const satisfies readonly EntityType[];

/**
 * Types whose public gate is `is_public AND status='active'` (not status
 * alone), so they need their own read branch. Research being absent from the
 * corpus was the sharpest gap: a topic search for a scientific subject could
 * not surface the research entity about that exact subject.
 */
export const PUBLIC_FLAG_ENTITY_TYPES = ['research', 'ai_assistant'] as const satisfies readonly EntityType[];

/** Events are published through a multi-state gate rather than status='active'. */
export const EVENT_PUBLIC_STATUSES = ['published', 'open', 'ongoing'];

export const ENTITY_CFG: Record<string, { table: string; basePath: string }> = Object.fromEntries(
  INDEXABLE_ENTITY_TYPES.map(t => {
    const meta = getEntityMetadata(t);
    return [t, { table: meta.tableName, basePath: meta.publicBasePath }];
  })
);

export async function buildCorpus(supabase: any): Promise<IndexItem[]> {
  const items: IndexItem[] = [];

  // Follower counts (one query) → per-profile connection signal.
  const followerCount = new Map<string, number>();
  const { data: follows } = await supabase.from(DATABASE_TABLES.FOLLOWS).select('following_id');
  for (const f of follows ?? []) {
    if (f.following_id) {
      followerCount.set(f.following_id, (followerCount.get(f.following_id) ?? 0) + 1);
    }
  }

  const { data: profiles } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select(
      'id, username, name, bio, location_city, updated_at, last_active_at, verification_status'
    )
    .not('username', 'is', null)
    .not('bio', 'is', null);
  for (const p of profiles ?? []) {
    const text = [p.name, p.bio, p.location_city].filter(Boolean).join('. ').trim();
    if (!text) {
      continue;
    }
    items.push({
      entity_type: 'profile',
      entity_id: p.id,
      title: p.name || p.username,
      url: publicProfilePath(p.username),
      text,
      updated_at: p.updated_at ?? null,
      quality: profileQuality({
        lastActiveAt: p.last_active_at,
        followers: followerCount.get(p.id) ?? 0,
        verified: isVerified(p.verification_status),
      }),
    });
  }

  // Types with their own public gate — kept in the corpus sweep so a full
  // rebuild covers exactly what reconcileOne would index for them.
  for (const type of PUBLIC_FLAG_ENTITY_TYPES) {
    const meta = getEntityMetadata(type);
    const { data } = await supabase
      .from(meta.tableName)
      .select('id, title, description, updated_at')
      .eq('is_public', true)
      .eq('status', ENTITY_STATUS.ACTIVE);
    for (const e of data ?? []) {
      const text = [e.title, e.description].filter(Boolean).join('. ').trim();
      if (text) {
        items.push({
          entity_type: type,
          entity_id: e.id,
          title: e.title || 'Untitled',
          url: `${meta.publicBasePath}/${e.id}`,
          text,
          updated_at: e.updated_at ?? null,
          quality: clamp01(recency(e.updated_at)),
        });
      }
    }
  }

  {
    const meta = getEntityMetadata('event');
    const { data } = await supabase
      .from(meta.tableName)
      .select('id, title, description, updated_at')
      .in('status', EVENT_PUBLIC_STATUSES);
    for (const e of data ?? []) {
      const text = [e.title, e.description].filter(Boolean).join('. ').trim();
      if (text) {
        items.push({
          entity_type: 'event',
          entity_id: e.id,
          title: e.title || 'Untitled',
          url: `${meta.publicBasePath}/${e.id}`,
          text,
          updated_at: e.updated_at ?? null,
          quality: clamp01(recency(e.updated_at)),
        });
      }
    }
  }

  for (const type of INDEXABLE_ENTITY_TYPES) {
    const { table, basePath } = ENTITY_CFG[type];
    const cols =
      type === 'cause'
        ? 'id, title, description, updated_at, total_raised, goal_amount'
        : 'id, title, description, updated_at';
    const { data } = await supabase.from(table).select(cols).eq('status', ENTITY_STATUS.ACTIVE);
    for (const e of data ?? []) {
      const text = [e.title, e.description].filter(Boolean).join('. ').trim();
      if (!text) {
        continue;
      }
      items.push({
        entity_type: type,
        entity_id: e.id,
        title: e.title || 'Untitled',
        url: `${basePath}/${e.id}`,
        text,
        updated_at: e.updated_at ?? null,
        quality:
          type === 'cause'
            ? causeQuality({
                updatedAt: e.updated_at,
                raised: Number(e.total_raised ?? 0),
                goal: Number(e.goal_amount ?? 0),
              })
            : clamp01(recency(e.updated_at)),
      });
    }
  }

  // Wishlists = the demand side. Index public + active ones so a standing
  // "I need X" lives in the same vector space as the "haves" (products/
  // services) and can be matched to what would meet it.
  const { data: wishlists } = await supabase
    .from(DATABASE_TABLES.WISHLISTS)
    .select('id, title, description, updated_at')
    .eq('visibility', 'public')
    .eq('is_active', true);
  for (const w of wishlists ?? []) {
    const text = await buildWishlistText(supabase, w);
    if (!text) {
      continue;
    }
    items.push({
      entity_type: 'wishlist',
      entity_id: w.id,
      title: w.title || 'Wishlist',
      url: `/wishlists/${w.id}`,
      text,
      updated_at: w.updated_at ?? null,
      quality: clamp01(recency(w.updated_at)),
    });
  }

  return items;
}

/**
 * Incremental sweep (cron safety net) or full re-embed (`full: true`). Embeds new/
 * changed items, refreshes quality_score for unchanged ones, prunes stale rows.
 */
