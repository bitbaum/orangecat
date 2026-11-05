/**
 * Proactive Cat — watch evaluation.
 *
 * Runs from the cat-watches cron route with the SERVICE-ROLE client (it spans
 * users); every per-user step is isolated so one bad user can't sink the
 * batch, and it is strictly no-LLM. Delivery is a platform notification (type
 * 'system', metadata.kind distinguishes the watch) linking back to the Cat.
 * The daily brief lives in daily-brief.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';
import { exploreTopicByVector } from './discovery-match';
import { evaluateSocialWatches, isSocialWatchKind, type SocialWatchRow } from './social-watches';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { notifyOwnerViaLoki } from '@/services/loki/notify-owner';

const LOG_SOURCE = 'CatProactive';
const MAX_WATCHES_PER_RUN = 500;

// ─── Watches ─────────────────────────────────────────────────────────────────

interface WatchRow {
  id: string;
  user_id: string;
  kind:
    | 'funding_reached'
    | 'sale_received'
    | 'booking_received'
    | 'topic_match'
    | SocialWatchRow['kind'];
  label: string;
  entity_type: string | null;
  entity_id: string | null;
  target_btc: number | null;
  topic: string | null;
  /** Stored when the user created the watch — the timer never embeds. */
  topic_embedding: string | number[] | null;
  subject_user_id: string | null;
  last_seen_at: string | null;
  created_at: string;
}

/** pgvector comes back over PostgREST as its text form, "[0.1,0.2,...]". */
function parseStoredVector(v: WatchRow['topic_embedding']): number[] | null {
  if (Array.isArray(v)) {
    return v;
  }
  if (typeof v !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) && parsed.every(n => typeof n === 'number') ? parsed : null;
  } catch {
    return null;
  }
}

/** Has this watch's condition become true? */
async function watchConditionMet(admin: SupabaseClient, watch: WatchRow): Promise<boolean> {
  if (watch.kind === 'topic_match') {
    if (!watch.topic) {
      return false;
    }
    // This runs on a timer, so it may not call the embedding provider: it
    // matches with the vector stored when the user asked for the watch. A
    // watch without one (created before the column existed) cannot fire.
    const vec = parseStoredVector(watch.topic_embedding);
    if (!vec) {
      return false;
    }
    // Fires on either channel: something published on the topic, or someone
    // declaring the interest. The watcher is excluded as the viewer, so their
    // own work can never trigger their own watch.
    const result = await exploreTopicByVector(
      admin as unknown as AnySupabaseClient,
      watch.user_id,
      watch.topic,
      vec
    );
    if (result.degraded) {
      return false;
    }
    return result.hits.length > 0 || result.people.length > 0;
  }

  if (watch.kind === 'funding_reached') {
    if (!watch.entity_id || !watch.target_btc) {
      return false;
    }
    const { data } = await admin
      .from(DATABASE_TABLES.PAYMENT_INTENTS)
      .select('amount_btc')
      .eq('entity_id', watch.entity_id)
      .eq('status', STATUS.PAYMENT_INTENTS.PAID);
    const total = ((data ?? []) as Array<{ amount_btc: number }>).reduce(
      (n, r) => n + (r.amount_btc || 0),
      0
    );
    return total >= watch.target_btc;
  }

  if (watch.kind === 'sale_received') {
    const { data } = await admin
      .from(DATABASE_TABLES.ORDERS)
      .select('id')
      .eq('seller_id', watch.user_id)
      .eq('status', STATUS.ORDERS.PAID)
      .gt('created_at', watch.created_at)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  }

  // booking_received — named, not a fall-through: an unknown kind must never
  // fire as if it were a booking.
  if (watch.kind !== 'booking_received') {
    return false;
  }
  const { data: actors } = await admin
    .from(DATABASE_TABLES.ACTORS)
    .select('id')
    .eq('user_id', watch.user_id);
  const actorIds = ((actors ?? []) as Array<{ id: string }>).map(a => a.id);
  if (actorIds.length === 0) {
    return false;
  }
  const { data } = await admin
    .from(DATABASE_TABLES.BOOKINGS)
    .select('id')
    .in('provider_actor_id', actorIds)
    .gt('created_at', watch.created_at)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export interface WatchRunResult {
  watchesChecked: number;
  fired: number;
  errors: number;
}

/** Evaluate all active watches; fire notifications and mark them fired. */
export async function runWatchEvaluation(admin: SupabaseClient): Promise<WatchRunResult> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.CAT_WATCHES)
    .select(
      'id, user_id, kind, label, entity_type, entity_id, target_btc, topic, topic_embedding, subject_user_id, last_seen_at, created_at'
    )
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(MAX_WATCHES_PER_RUN);
  if (error) {
    logger.error('watch load failed', { error }, LOG_SOURCE);
    return { watchesChecked: 0, fired: 0, errors: 1 };
  }

  const all = (data ?? []) as WatchRow[];
  const notifications = new NotificationService(admin);
  const result: WatchRunResult = { watchesChecked: all.length, fired: 0, errors: 0 };

  // Watches on people are standing and cursor-based, and evaluated in one
  // batch (./social-watches); the rest fire once and are judged one by one.
  const social = all.filter((w): w is WatchRow & SocialWatchRow => isSocialWatchKind(w.kind));
  const watches = all.filter(w => !isSocialWatchKind(w.kind));
  const socialResult = await evaluateSocialWatches(admin, social, notifications);
  result.fired += socialResult.fired;
  result.errors += socialResult.errors;

  for (const watch of watches) {
    try {
      if (!(await watchConditionMet(admin, watch))) {
        continue;
      }
      // Mark fired BEFORE notifying: a double notification (crash between
      // notify and update) is worse than a missed one the user can re-create.
      const { error: updateError } = await admin
        .from(DATABASE_TABLES.CAT_WATCHES)
        .update({ status: 'fired', fired_at: new Date().toISOString() })
        .eq('id', watch.id)
        .eq('status', 'active');
      if (updateError) {
        result.errors += 1;
        continue;
      }
      const sent = await notifications.createNotification({
        recipientUserId: watch.user_id,
        type: 'system',
        title: 'Cat watch fired',
        message: `👁️ ${watch.label}`,
        actionUrl: '/dashboard/cat',
        metadata: { kind: 'cat_watch', watchId: watch.id, watchKind: watch.kind },
      });
      if (sent.success) {
        result.fired += 1;
        await notifyOwnerViaLoki(watch.user_id, {
          source: 'cat-watch',
          title: `Your watch fired: ${watch.label}`,
          action: { label: 'Open the Cat', path: '/dashboard/cat' },
          key: `cat-watch:${watch.id}`,
        });
      } else {
        result.errors += 1;
      }
    } catch (error) {
      result.errors += 1;
      logger.error('watch evaluation failed', { watchId: watch.id, error }, LOG_SOURCE);
    }
  }
  return result;
}
