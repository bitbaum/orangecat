/**
 * Two-sided introduction — the push half of discovery.
 *
 * Ordinary search is PULL: a person types a query and finds supply. That leaves
 * the demander doing all the work, and the person who wished for a thing is never
 * told when it finally exists. This closes that gap: when a listing or a wishlist
 * is (re)indexed, we match it against the OPPOSITE side of the market (supply↔
 * demand, in the same vector space) and, on a strong match, notify BOTH people —
 * the wisher ("what you wanted now exists") and the lister ("someone is looking
 * for exactly this").
 *
 * Idempotent per (supply, demand) pair via match_introductions, so the repeated
 * reconciles that fire on every write/update/quality-sweep never re-notify.
 * Fire-and-forget from reindexService.reconcileOne; never throws.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { logger } from '@/utils/logger';

/** An introduction is a stronger claim than a search hit, so the bar is higher. */
const INTRO_MIN_SIMILARITY = 0.55;
const MAX_INTROS_PER_EVENT = 3;
const SUPPLY_TYPES = new Set(['product', 'service']);

/** Minimal shape shared by an IndexItem and a match_content result row. */
interface Side {
  entity_type: string;
  entity_id: string;
  title: string;
  url: string;
}

/** Resolve an entity's owning auth user: entity → actor_id → actors.user_id. */
async function resolveOwnerUserId(
  supabase: AnySupabaseClient,
  entityType: string,
  entityId: string
): Promise<string | null> {
  let table: string;
  try {
    table = getEntityMetadata(entityType as EntityType).tableName;
  } catch {
    return null;
  }
  const { data: ent } = await supabase
    .from(table)
    .select('actor_id')
    .eq('id', entityId)
    .maybeSingle();
  if (!ent?.actor_id) {
    return null;
  }
  const { data: actor } = await supabase
    .from(DATABASE_TABLES.ACTORS)
    .select('user_id')
    .eq('id', ent.actor_id)
    .eq('actor_type', 'user')
    .maybeSingle();
  return actor?.user_id ?? null;
}

export async function introduceMatches(
  supabase: AnySupabaseClient,
  self: Side,
  embedding: number[]
): Promise<void> {
  try {
    const selfIsDemand = self.entity_type === 'wishlist';

    // Match against the OTHER side of the market. Demand → supply; supply →
    // demand. match_content takes one filter; for demand we pass none and keep
    // only supply rows (excludes profiles/causes/other wishlists).
    const { data: rawMatches } = await supabase.rpc('match_content', {
      query_embedding: JSON.stringify(embedding),
      match_count: 12,
      filter_type: selfIsDemand ? null : 'wishlist',
      min_similarity: INTRO_MIN_SIMILARITY,
    });
    let matches = (rawMatches ?? []) as Side[];
    if (selfIsDemand) {
      matches = matches.filter(m => SUPPLY_TYPES.has(m.entity_type));
    }
    if (matches.length === 0) {
      return;
    }

    const selfOwner = await resolveOwnerUserId(supabase, self.entity_type, self.entity_id);

    let made = 0;
    for (const other of matches) {
      if (made >= MAX_INTROS_PER_EVENT) {
        break;
      }
      const supply: Side = selfIsDemand ? other : self;
      const demand: Side = selfIsDemand ? self : other;

      // Idempotency: introduce each (supply, demand) pair at most once. The
      // unique constraint turns a duplicate into an insert error we skip on.
      const { error: dupErr } = await supabase.from(DATABASE_TABLES.MATCH_INTRODUCTIONS).insert({
        supply_type: supply.entity_type,
        supply_id: supply.entity_id,
        demand_type: demand.entity_type,
        demand_id: demand.entity_id,
      });
      if (dupErr) {
        continue; // already introduced (unique violation) — or a transient error; skip safely
      }

      const otherOwner = await resolveOwnerUserId(supabase, other.entity_type, other.entity_id);
      const wisherId = selfIsDemand ? selfOwner : otherOwner;
      const listerId = selfIsDemand ? otherOwner : selfOwner;
      // Never introduce someone to their own listing/wish.
      if (!wisherId || !listerId || wisherId === listerId) {
        made++;
        continue;
      }

      await NotificationDispatcher.dispatch({
        userId: wisherId,
        type: 'match',
        title: 'Your wishlist found a match',
        message: `"${supply.title}" matches something you're looking for.`,
        actionUrl: supply.url,
        sourceEntityType: supply.entity_type,
        sourceEntityId: supply.entity_id,
      });
      await NotificationDispatcher.dispatch({
        userId: listerId,
        type: 'match',
        title: 'Someone is looking for what you offer',
        message: `Your "${supply.title}" matches an open wishlist.`,
        actionUrl: demand.url,
        sourceEntityType: demand.entity_type,
        sourceEntityId: demand.entity_id,
      });
      made++;
    }
    if (made > 0) {
      logger.info('two-sided introductions made', { self: self.entity_type, count: made }, 'Match');
    }
  } catch (err) {
    logger.warn('introduceMatches error (non-fatal)', { err }, 'Match');
  }
}
