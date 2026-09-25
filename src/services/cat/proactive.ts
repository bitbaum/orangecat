/**
 * Proactive Cat — the daily brief and watch evaluation.
 *
 * Both run from cron routes with the SERVICE-ROLE client (they span users);
 * every per-user step is isolated so one bad user can't sink the batch, and
 * both are strictly no-LLM: pure data reads composed into short sentences.
 * Delivery is a platform notification (type 'system', metadata.kind
 * distinguishes brief vs watch) linking back to the Cat.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';
import { countUnreadNotifications } from '@/services/notifications/unread-count';
import { exploreTopicByVector } from './discovery-match';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const LOG_SOURCE = 'CatProactive';

/** Only brief users who actually use the Cat (7-day activity window). */
const ACTIVE_USER_WINDOW_DAYS = 7;
/** Look-back for "what happened" signals in the brief. */
const BRIEF_SALES_WINDOW_HOURS = 24;
/** Look-ahead for upcoming bookings in the brief. */
const BRIEF_BOOKINGS_WINDOW_HOURS = 48;
const MAX_WATCHES_PER_RUN = 500;

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function hoursAheadIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function todayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatBtc(amount: number): string {
  return `${Number(amount.toFixed(8))} BTC`;
}

// ─── Daily brief ─────────────────────────────────────────────────────────────

/** Users with Cat activity in the window — the brief audience. */
export async function findActiveCatUsers(admin: SupabaseClient, limit: number): Promise<string[]> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.CAT_MESSAGES)
    .select('user_id')
    .gte('created_at', hoursAgoIso(ACTIVE_USER_WINDOW_DAYS * 24))
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) {
    logger.error('findActiveCatUsers failed', { error }, LOG_SOURCE);
    return [];
  }
  const unique = [...new Set(((data ?? []) as Array<{ user_id: string }>).map(r => r.user_id))];
  return unique.slice(0, limit);
}

async function briefAlreadySentToday(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from(DATABASE_TABLES.NOTIFICATIONS)
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', todayStartIso())
    .eq('metadata->>kind', 'cat_brief')
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Compose the brief for one user from live data. Returns null when there is
 * nothing worth saying — an empty brief is spam, not proactivity.
 */
export async function composeDailyBrief(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const [actorRows, salesRes, tasksRes, unread] = await Promise.all([
    admin.from(DATABASE_TABLES.ACTORS).select('id').eq('user_id', userId),
    admin
      .from(DATABASE_TABLES.ORDERS)
      .select('amount_btc')
      .eq('seller_id', userId)
      .eq('status', STATUS.ORDERS.PAID)
      .gte('created_at', hoursAgoIso(BRIEF_SALES_WINDOW_HOURS)),
    admin
      .from(DATABASE_TABLES.TASKS)
      .select('title, due_date')
      .eq('created_by', userId)
      .eq('is_archived', false)
      .eq('is_completed', false)
      .lt('due_date', new Date().toISOString())
      .limit(10),
    countUnreadNotifications(admin, userId).catch(() => 0),
  ]);

  const actorIds = ((actorRows.data ?? []) as Array<{ id: string }>).map(a => a.id);
  const bookingsRes =
    actorIds.length > 0
      ? await admin
          .from(DATABASE_TABLES.BOOKINGS)
          .select('starts_at')
          .in('provider_actor_id', actorIds)
          .in('status', [STATUS.BOOKINGS.CONFIRMED, STATUS.BOOKINGS.PENDING])
          .gte('starts_at', new Date().toISOString())
          .lte('starts_at', hoursAheadIso(BRIEF_BOOKINGS_WINDOW_HOURS))
      : { data: [] };

  const sales = (salesRes.data ?? []) as Array<{ amount_btc: number }>;
  const overdue = (tasksRes.data ?? []) as Array<{ title: string }>;
  const bookings = (bookingsRes.data ?? []) as Array<{ starts_at: string }>;

  const parts: string[] = [];
  if (sales.length > 0) {
    const total = sales.reduce((n, s) => n + (s.amount_btc || 0), 0);
    parts.push(
      `${sales.length} sale${sales.length === 1 ? '' : 's'} (${formatBtc(total)}) in the last 24h`
    );
  }
  if (bookings.length > 0) {
    parts.push(`${bookings.length} booking${bookings.length === 1 ? '' : 's'} in the next 48h`);
  }
  if (overdue.length > 0) {
    parts.push(
      `${overdue.length} task${overdue.length === 1 ? '' : 's'} overdue (first: "${overdue[0].title}")`
    );
  }
  if (unread > 0) {
    parts.push(`${unread} unread notification${unread === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) {
    return null;
  }
  return `☀️ Daily brief: ${parts.join(' · ')}. Ask your Cat for details or next steps.`;
}

export interface BriefRunResult {
  usersConsidered: number;
  briefsSent: number;
  errors: number;
}

/**
 * An earlier day's brief describes a state that has since moved on, so it
 * stops counting as unread once a new day's run reaches the user. Without this
 * the briefs piled up one a day — 51 of one account's 80 unread — and each new
 * brief then reported the pile of old briefs as "unread notifications".
 */
async function supersedeOldBriefs(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin
    .from(DATABASE_TABLES.NOTIFICATIONS)
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('metadata->>kind', 'cat_brief');
  if (error) {
    logger.warn('could not supersede old briefs', { userId, error }, LOG_SOURCE);
  }
}

/** Run the daily brief over all active Cat users. Idempotent per day. */
export async function runDailyBrief(admin: SupabaseClient, limit: number): Promise<BriefRunResult> {
  const users = await findActiveCatUsers(admin, limit);
  const notifications = new NotificationService(admin);
  const result: BriefRunResult = { usersConsidered: users.length, briefsSent: 0, errors: 0 };

  for (const userId of users) {
    try {
      if (await briefAlreadySentToday(admin, userId)) {
        continue;
      }
      await supersedeOldBriefs(admin, userId);
      const brief = await composeDailyBrief(admin, userId);
      if (!brief) {
        continue;
      }
      const sent = await notifications.createNotification({
        recipientUserId: userId,
        type: 'system',
        title: 'Your Cat daily brief',
        message: brief,
        actionUrl: '/dashboard/cat',
        metadata: { kind: 'cat_brief' },
      });
      if (sent.success) {
        result.briefsSent += 1;
      } else {
        result.errors += 1;
      }
    } catch (error) {
      result.errors += 1;
      logger.error('daily brief failed for user', { userId, error }, LOG_SOURCE);
    }
  }
  return result;
}

// ─── Watches ─────────────────────────────────────────────────────────────────

interface WatchRow {
  id: string;
  user_id: string;
  kind: 'funding_reached' | 'sale_received' | 'booking_received' | 'topic_match';
  label: string;
  entity_type: string | null;
  entity_id: string | null;
  target_btc: number | null;
  topic: string | null;
  /** Stored when the user created the watch — the timer never embeds. */
  topic_embedding: string | number[] | null;
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

  // booking_received
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
      'id, user_id, kind, label, entity_type, entity_id, target_btc, topic, topic_embedding, created_at'
    )
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(MAX_WATCHES_PER_RUN);
  if (error) {
    logger.error('watch load failed', { error }, LOG_SOURCE);
    return { watchesChecked: 0, fired: 0, errors: 1 };
  }

  const watches = (data ?? []) as WatchRow[];
  const notifications = new NotificationService(admin);
  const result: WatchRunResult = { watchesChecked: watches.length, fired: 0, errors: 0 };

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
