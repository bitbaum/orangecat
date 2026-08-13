/**
 * Semantic-index reconciler — keeps content_embeddings in sync with the searchable
 * corpus (public profiles w/ a bio + ACTIVE entities). Business logic for
 * POST /api/admin/reindex-embeddings; the route is a thin auth+delegate wrapper.
 *
 *   - reconcileOne: O(1) single-row reconcile (DB trigger fires this on each write).
 *   - reconcileCorpus: incremental sweep (cron safety net) or full re-embed.
 *
 * Decoupled from the write path: saving a profile never waits on an embedding call;
 * this converges the index in the background, and tolerates the provider being down.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { embedTexts } from '@/services/ai/embeddings';
import { ENTITY_STATUS } from '@/config/database-constants';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';
import { introduceMatches } from '@/services/match/reverseMatch';
import { clamp01, recency, isVerified, profileQuality, causeQuality } from './reindex-scoring';
import { publicProfilePath } from '@/config/public-profile-path';
import {
  buildCorpus,
  buildWishlistText,
  ENTITY_CFG,
  EVENT_PUBLIC_STATUSES,
  PUBLIC_FLAG_ENTITY_TYPES,
  type IndexItem,
} from './reindex-sources';

export interface ReconcileResult {
  success: true;
  mode: 'single' | 'incremental' | 'full';
  indexed: number;
  pruned: number;
  failed: number;
  corpus?: number;
  skipped?: number;
  qualityRefreshed?: number;
}

// ── Quality signals (real outcomes) ─────────────────────────────────────────
const EMBED_BATCH = 96;
const key = (t: string, id: string) => `${t}:${id}`;

const isNewer = (a: string | null, b: string | null) => {
  if (!a) {
    return false;
  } // no source timestamp ⇒ don't force re-embed
  if (!b) {
    return true;
  } // never embedded ⇒ embed
  return new Date(a).getTime() > new Date(b).getTime();
};

/**
 * Reconcile ONE row (called near-instantly by the DB trigger on a write).
 * Embeds it if it qualifies (public profile w/ bio, or active entity w/ text),
 * otherwise prunes it (deleted / deactivated / bio removed). O(1).
 */
export async function reconcileOne(
  supabase: any,
  type: string,
  id: string
): Promise<{ indexed: number; pruned: number; failed: number }> {
  let item: IndexItem | null = null;

  if (type === 'profile') {
    const { data } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select(
        'id, username, name, bio, location_city, updated_at, last_active_at, verification_status'
      )
      .eq('id', id)
      .maybeSingle();
    if (data?.username && data?.bio) {
      const text = [data.name, data.bio, data.location_city].filter(Boolean).join('. ').trim();
      if (text) {
        const { count: followers } = await supabase
          .from(DATABASE_TABLES.FOLLOWS)
          .select('id', { count: 'exact', head: true })
          .eq('following_id', data.id);
        item = {
          entity_type: 'profile',
          entity_id: data.id,
          title: data.name || data.username,
          url: publicProfilePath(data.username),
          text,
          updated_at: data.updated_at ?? null,
          quality: profileQuality({
            lastActiveAt: data.last_active_at,
            followers: followers ?? 0,
            verified: isVerified(data.verification_status),
          }),
        };
      }
    }
  } else if (ENTITY_CFG[type]) {
    const { table, basePath } = ENTITY_CFG[type];
    const cols =
      type === 'cause'
        ? 'id, title, description, status, updated_at, total_raised, goal_amount'
        : 'id, title, description, status, updated_at';
    const { data } = await supabase.from(table).select(cols).eq('id', id).maybeSingle();
    if (data && data.status === ENTITY_STATUS.ACTIVE) {
      const text = [data.title, data.description].filter(Boolean).join('. ').trim();
      if (text) {
        item = {
          entity_type: type,
          entity_id: data.id,
          title: data.title || 'Untitled',
          url: `${basePath}/${data.id}`,
          text,
          updated_at: data.updated_at ?? null,
          quality:
            type === 'cause'
              ? causeQuality({
                  updatedAt: data.updated_at,
                  raised: Number(data.total_raised ?? 0),
                  goal: Number(data.goal_amount ?? 0),
                })
              : clamp01(recency(data.updated_at)),
        };
      }
    }
  } else if (PUBLIC_FLAG_ENTITY_TYPES.includes(type as (typeof PUBLIC_FLAG_ENTITY_TYPES)[number])) {
    // Types gated on is_public AND status, not status alone. Research is the
    // headline case: it was absent from the corpus entirely, so an interest
    // search for a scientific topic could never surface the research entity
    // that is literally about it.
    const meta = getEntityMetadata(type as EntityType);
    const { data } = await supabase
      .from(meta.tableName)
      .select('id, title, description, status, is_public, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (data && data.is_public && data.status === ENTITY_STATUS.ACTIVE) {
      const text = [data.title, data.description].filter(Boolean).join('. ').trim();
      if (text) {
        item = {
          entity_type: type,
          entity_id: data.id,
          title: data.title || 'Untitled',
          url: `${meta.publicBasePath}/${data.id}`,
          text,
          updated_at: data.updated_at ?? null,
          quality: clamp01(recency(data.updated_at)),
        };
      }
    }
  } else if (type === 'event') {
    // Events use a multi-state publish gate rather than status='active'.
    const meta = getEntityMetadata('event');
    const { data } = await supabase
      .from(meta.tableName)
      .select('id, title, description, status, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (data && EVENT_PUBLIC_STATUSES.includes(data.status)) {
      const text = [data.title, data.description].filter(Boolean).join('. ').trim();
      if (text) {
        item = {
          entity_type: 'event',
          entity_id: data.id,
          title: data.title || 'Untitled',
          url: `${meta.publicBasePath}/${data.id}`,
          text,
          updated_at: data.updated_at ?? null,
          quality: clamp01(recency(data.updated_at)),
        };
      }
    }
  } else if (type === 'wishlist') {
    // The demand side. A public, active wishlist is a standing "I need X" —
    // indexed into the same vector space as supply so the two can be matched.
    // (Wishlists key on visibility/is_active, not status='active', so they need
    // this dedicated branch rather than the generic ENTITY_CFG path.)
    const { data } = await supabase
      .from(DATABASE_TABLES.WISHLISTS)
      .select('id, title, description, visibility, is_active, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (data && data.visibility === 'public' && data.is_active) {
      const text = await buildWishlistText(supabase, data);
      if (text) {
        item = {
          entity_type: 'wishlist',
          entity_id: data.id,
          title: data.title || 'Wishlist',
          url: `/wishlists/${data.id}`,
          text,
          updated_at: data.updated_at ?? null,
          quality: clamp01(recency(data.updated_at)),
        };
      }
    }
  }

  if (!item) {
    await supabase
      .from(DATABASE_TABLES.CONTENT_EMBEDDINGS)
      .delete()
      .eq('entity_type', type)
      .eq('entity_id', id);
    return { indexed: 0, pruned: 1, failed: 0 };
  }

  const [vec] = await embedTexts([item.text]);
  if (!vec) {
    return { indexed: 0, pruned: 0, failed: 1 };
  }
  const { error } = await supabase.from(DATABASE_TABLES.CONTENT_EMBEDDINGS).upsert(
    [
      {
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        title: item.title,
        url: item.url,
        text_preview: item.text.slice(0, 500),
        embedding: JSON.stringify(vec),
        quality_score: item.quality,
        updated_at: item.updated_at ?? new Date().toISOString(),
      },
    ],
    { onConflict: 'entity_type,entity_id' }
  );
  if (error) {
    return { indexed: 0, pruned: 0, failed: 1 };
  }

  // Two-sided introduction: a freshly (re)indexed listing or wishlist may match
  // an open counterpart on the other side of the market. Idempotent per pair, so
  // repeated reconciles (updates, corpus sweeps) never re-notify. Best-effort —
  // an introduction failure must never fail the index write.
  if (
    item.entity_type === 'product' ||
    item.entity_type === 'service' ||
    item.entity_type === 'wishlist'
  ) {
    await introduceMatches(supabase, item, vec).catch(err =>
      logger.warn('introduceMatches failed', { err }, 'Reindex')
    );
  }
  return { indexed: 1, pruned: 0, failed: 0 };
}

/** Build the full current searchable corpus (profiles + active indexable entities). */
export async function reconcileCorpus(
  supabase: any,
  { full }: { full: boolean }
): Promise<ReconcileResult> {
  // 1. Current corpus (with source timestamps)
  const items = await buildCorpus(supabase);

  // 2. What's already indexed (key → last-embedded source timestamp)
  const { data: existingRows } = await supabase
    .from(DATABASE_TABLES.CONTENT_EMBEDDINGS)
    .select('entity_type, entity_id, updated_at');
  const existing = new Map<string, string | null>();
  for (const r of existingRows ?? []) {
    existing.set(key(r.entity_type, r.entity_id), r.updated_at ?? null);
  }

  // 3. Diff: what needs (re)embedding, what to prune
  const currentKeys = new Set(items.map(it => key(it.entity_type, it.entity_id)));
  const toEmbed = full
    ? items
    : items.filter(it => {
        const k = key(it.entity_type, it.entity_id);
        return !existing.has(k) || isNewer(it.updated_at, existing.get(k) ?? null);
      });
  const toPrune = [...existing.keys()].filter(k => !currentKeys.has(k));

  // 4. Embed + upsert (store SOURCE updated_at so the next diff works)
  let indexed = 0;
  let failed = 0;
  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH);
    const vectors = await embedTexts(batch.map(b => b.text));
    const rows = batch
      .map((b, j) => {
        const vec = vectors[j];
        if (!vec) {
          failed++;
          return null;
        }
        return {
          entity_type: b.entity_type,
          entity_id: b.entity_id,
          title: b.title,
          url: b.url,
          text_preview: b.text.slice(0, 500),
          embedding: JSON.stringify(vec),
          quality_score: b.quality,
          updated_at: b.updated_at ?? new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length > 0) {
      const { error } = await supabase
        .from(DATABASE_TABLES.CONTENT_EMBEDDINGS)
        .upsert(rows, { onConflict: 'entity_type,entity_id' });
      if (error) {
        logger.error('content_embeddings upsert failed', { error }, 'Reindex');
        failed += rows.length;
      } else {
        indexed += rows.length;
      }
    }
  }

  // 4b. Refresh quality_score for UNCHANGED items. Outcomes (new follows, funding,
  // activity) change a profile's quality without changing its own row, so they
  // wouldn't be re-embedded. Cheaply update just the score, keeping ranking current.
  let qualityRefreshed = 0;
  const embeddedKeys = new Set(toEmbed.map(it => key(it.entity_type, it.entity_id)));
  for (const it of items) {
    if (embeddedKeys.has(key(it.entity_type, it.entity_id))) {
      continue;
    }
    const { error } = await supabase
      .from(DATABASE_TABLES.CONTENT_EMBEDDINGS)
      .update({ quality_score: it.quality })
      .eq('entity_type', it.entity_type)
      .eq('entity_id', it.entity_id);
    if (!error) {
      qualityRefreshed++;
    }
  }

  // 5. Prune stale rows (deleted / deactivated / bio removed)
  let pruned = 0;
  for (const k of toPrune) {
    const [etype, eid] = k.split(':');
    const { error } = await supabase
      .from(DATABASE_TABLES.CONTENT_EMBEDDINGS)
      .delete()
      .eq('entity_type', etype)
      .eq('entity_id', eid);
    if (!error) {
      pruned++;
    }
  }

  const result: ReconcileResult = {
    success: true,
    mode: full ? 'full' : 'incremental',
    corpus: items.length,
    indexed,
    skipped: items.length - toEmbed.length,
    qualityRefreshed,
    pruned,
    failed,
  };
  logger.info('Reindex reconcile complete', result, 'Reindex');
  return result;
}
