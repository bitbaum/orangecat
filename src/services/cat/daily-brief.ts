/**
 * The Cat's daily brief — a short, data-only morning summary per active user.
 *
 * Runs from the cat-brief cron route with the SERVICE-ROLE client (it spans
 * users); every per-user step is isolated so one bad user can't sink the batch,
 * and it is strictly no-LLM: pure data reads composed into short sentences.
 * Delivery is a platform notification (type 'system', metadata.kind
 * 'cat_brief') linking back to the Cat. Watch evaluation lives in proactive.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';
import { countUnreadNotifications } from '@/services/notifications/unread-count';
import { displayBTC } from '@/services/currency/formatting';
import { notifyOwnerViaLoki, type OwnerNotice } from '@/services/loki/notify-owner';

const LOG_SOURCE = 'CatProactive';

/** Only brief users who actually use the Cat (7-day activity window). */
const ACTIVE_USER_WINDOW_DAYS = 7;
/** Look-back for "what happened" signals in the brief. */
const BRIEF_SALES_WINDOW_HOURS = 24;
/** Look-ahead for upcoming bookings in the brief. */
const BRIEF_BOOKINGS_WINDOW_HOURS = 48;

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
/** What the brief is made of — the same facts for the in-app line and the owner's phone. */
export interface BriefFacts {
  salesCount: number;
  salesBtc: number;
  bookingsCount: number;
  overdueTitles: string[];
  unread: number;
}

export async function collectBriefFacts(
  admin: SupabaseClient,
  userId: string
): Promise<BriefFacts> {
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
  return {
    salesCount: sales.length,
    salesBtc: sales.reduce((n, s) => n + (s.amount_btc || 0), 0),
    bookingsCount: ((bookingsRes.data ?? []) as unknown[]).length,
    overdueTitles: ((tasksRes.data ?? []) as Array<{ title: string }>).map(t => t.title),
    unread,
  };
}

/** The in-app brief line, or null when there is nothing to say. */
export function briefText(f: BriefFacts): string | null {
  const parts: string[] = [];
  if (f.salesCount > 0) {
    parts.push(
      `${f.salesCount} sale${f.salesCount === 1 ? '' : 's'} (${displayBTC(f.salesBtc)}) in the last 24h`
    );
  }
  if (f.bookingsCount > 0) {
    parts.push(`${f.bookingsCount} booking${f.bookingsCount === 1 ? '' : 's'} in the next 48h`);
  }
  if (f.overdueTitles.length > 0) {
    parts.push(
      `${f.overdueTitles.length} task${f.overdueTitles.length === 1 ? '' : 's'} overdue (first: "${f.overdueTitles[0]}")`
    );
  }
  if (f.unread > 0) {
    parts.push(`${f.unread} unread notification${f.unread === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return `☀️ Daily brief: ${parts.join(' · ')}. Ask your Cat for details or next steps.`;
}

/**
 * The owner's brief as a Telegram notice — or null, which is the usual answer.
 *
 * The owner, 2026-11-02, under "Daily brief: 33 unread notifications. Ask
 * your Cat for details": a message must be answerable with one tap. A count
 * of unread notifications is not, so it never goes to the phone. Only a thing
 * he can act on does, and the button opens that thing: the overdue task, the
 * upcoming booking, the sale.
 */
export function ownerBriefNotice(f: BriefFacts): OwnerNotice | null {
  if (f.overdueTitles.length > 0) {
    const more = f.overdueTitles.length - 1;
    return {
      source: 'cat',
      title: `Overdue: ${f.overdueTitles[0]}${more > 0 ? ` (+${more} more)` : ''}`,
      action: { label: 'Open tasks', path: '/dashboard/tasks' },
      key: 'cat-brief:overdue',
    };
  }
  if (f.bookingsCount > 0) {
    return {
      source: 'cat',
      title: `${f.bookingsCount} booking${f.bookingsCount === 1 ? '' : 's'} in the next 48 hours`,
      action: { label: 'See bookings', path: '/dashboard/bookings' },
      key: 'cat-brief:bookings',
    };
  }
  if (f.salesCount > 0) {
    return {
      source: 'cat',
      title: `${f.salesCount} sale${f.salesCount === 1 ? '' : 's'} yesterday (${displayBTC(f.salesBtc)})`,
      action: { label: 'See sales', path: '/dashboard/store' },
      key: 'cat-brief:sales',
    };
  }
  return null;
}

export async function composeDailyBrief(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  return briefText(await collectBriefFacts(admin, userId));
}

export interface BriefRunResult {
  usersConsidered: number;
  briefsSent: number;
  errors: number;
  /** Users the run did not reach before its time budget ran out. */
  deferred: number;
  /** The budget ran out before the run finished. */
  outOfTime: boolean;
}

/**
 * How long one brief run may take. The timer's curl gives up at 120s and
 * receives nothing at all, so a run that is still going when it does leaves
 * only `curl: (28) … 0 bytes received` behind: no counts, no hint of which user
 * it was on. A run that stops itself first answers in time with what it did.
 */
export const BRIEF_RUN_BUDGET_MS = 90_000;

const OUT_OF_TIME = Symbol('out-of-time');

/** `work`, or OUT_OF_TIME once `ms` has passed. Never leaves a timer behind. */
async function withinBudget<T>(work: Promise<T>, ms: number): Promise<T | typeof OUT_OF_TIME> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof OUT_OF_TIME>(resolve => {
    timer = setTimeout(() => resolve(OUT_OF_TIME), ms);
  });
  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
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

/** One user's brief. Never throws: a failure is counted, not propagated. */
async function briefOneUser(
  admin: SupabaseClient,
  notifications: NotificationService,
  userId: string
): Promise<'sent' | 'skipped' | 'failed'> {
  try {
    if (await briefAlreadySentToday(admin, userId)) {
      return 'skipped';
    }
    await supersedeOldBriefs(admin, userId);
    const facts = await collectBriefFacts(admin, userId);
    const brief = briefText(facts);
    if (!brief) {
      return 'skipped';
    }
    const sent = await notifications.createNotification({
      recipientUserId: userId,
      type: 'system',
      title: 'Your Cat daily brief',
      message: brief,
      actionUrl: '/dashboard/cat',
      metadata: { kind: 'cat_brief' },
    });
    if (!sent.success) {
      return 'failed';
    }
    const notice = ownerBriefNotice(facts);
    if (notice) {
      await notifyOwnerViaLoki(userId, notice);
    }
    return 'sent';
  } catch (error) {
    logger.error('daily brief failed for user', { userId, error }, LOG_SOURCE);
    return 'failed';
  }
}

/**
 * Run the daily brief over all active Cat users. Idempotent per day.
 *
 * Bounded by `budgetMs`: a user whose step is still running when the budget
 * ends is left to finish on its own (it only ever writes that user's one
 * brief), every user not yet reached is counted in `deferred`, and the user it
 * stalled on is named in the log — a stalled run says where, not just that.
 */
export async function runDailyBrief(
  admin: SupabaseClient,
  limit: number,
  budgetMs: number = BRIEF_RUN_BUDGET_MS
): Promise<BriefRunResult> {
  const deadline = Date.now() + budgetMs;
  const result: BriefRunResult = {
    usersConsidered: 0,
    briefsSent: 0,
    errors: 0,
    deferred: 0,
    outOfTime: false,
  };

  const users = await withinBudget(findActiveCatUsers(admin, limit), budgetMs);
  if (users === OUT_OF_TIME) {
    logger.error('daily brief could not list active users in time', { budgetMs }, LOG_SOURCE);
    result.outOfTime = true;
    return result;
  }
  result.usersConsidered = users.length;
  const notifications = new NotificationService(admin);

  for (let i = 0; i < users.length; i++) {
    const userId = users[i];
    const left = deadline - Date.now();
    const outcome =
      left > 0 ? await withinBudget(briefOneUser(admin, notifications, userId), left) : OUT_OF_TIME;
    if (outcome === OUT_OF_TIME) {
      result.deferred = users.length - i;
      result.outOfTime = true;
      logger.error(
        'daily brief ran out of time',
        { budgetMs, stalledOn: userId, done: i, deferred: result.deferred },
        LOG_SOURCE
      );
      break;
    }
    if (outcome === 'sent') {
      result.briefsSent += 1;
    } else if (outcome === 'failed') {
      result.errors += 1;
    }
  }
  return result;
}
