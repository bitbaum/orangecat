/**
 * Cat read surface — answers "what do I have / how am I doing" questions with
 * live platform data instead of whatever happened to be in the context budget.
 *
 * This is deliberately a READ-ONLY service: no verb here mutates anything, so
 * it runs without the permission/confirmation machinery. Every topic degrades
 * to an honest "couldn't read X" line instead of throwing — a partial answer
 * from real data beats a failed tool call the model then papers over.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { CAT_CREATABLE_ENTITY_TYPES } from '@/types/cat';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export { MY_DATA_TOPICS, type MyDataTopic } from './my-data-topics';
import type { MyDataTopic } from './my-data-topics';
import { listInterests } from './interests';
import { countUnreadNotifications } from '@/services/notifications/unread-count';

const DEFAULT_WINDOW_DAYS = 30;
const MAX_ROWS_PER_TYPE = 8;

function formatBtc(amount: number): string {
  // Trim trailing zeros but keep BTC precision meaningful.
  return `${Number(amount.toFixed(8))} BTC`;
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchActorIds(supabase: AnySupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from(DATABASE_TABLES.ACTORS).select('id').eq('user_id', userId);
  return (data ?? []).map((a: { id: string }) => a.id);
}

/**
 * Rows for one entity type, tolerant of schema drift: retries without the
 * status column when a table doesn't have one (e.g. groups).
 */
async function fetchEntityRows(
  supabase: AnySupabaseClient,
  type: EntityType,
  userId: string,
  actorIds: string[]
): Promise<Array<{ title: string; status: string | null }>> {
  const meta = ENTITY_REGISTRY[type];
  const titleCol = meta.titleColumn ?? 'title';

  const run = async (withStatus: boolean) => {
    let q = supabase
      .from(meta.tableName)
      .select(withStatus ? `${titleCol}, status` : titleCol)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS_PER_TYPE);
    if (meta.userIdField === 'actor_id') {
      if (actorIds.length === 0) {
        return { data: [], error: null };
      }
      q = q.in('actor_id', actorIds);
    } else {
      q = q.eq(meta.userIdField, userId);
    }
    return q;
  };

  let { data, error } = await run(true);
  if (error) {
    ({ data, error } = await run(false));
  }
  if (error || !data) {
    return [];
  }
  return (data as Array<Record<string, unknown>>).map(row => ({
    title: String(row[titleCol] ?? '(untitled)'),
    status: typeof row.status === 'string' ? row.status : null,
  }));
}

async function listingsSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const actorIds = await fetchActorIds(supabase, userId);
    const perType = await Promise.all(
      CAT_CREATABLE_ENTITY_TYPES.map(async type => ({
        type,
        rows: await fetchEntityRows(supabase, type, userId, actorIds),
      }))
    );
    const nonEmpty = perType.filter(t => t.rows.length > 0);
    if (nonEmpty.length === 0) {
      return 'LISTINGS: none yet — the user has not created any entities.';
    }
    const lines = nonEmpty.map(({ type, rows }) => {
      const meta = ENTITY_REGISTRY[type];
      const items = rows.map(r => `"${r.title}"${r.status ? ` (${r.status})` : ''}`).join(', ');
      return `- ${meta.namePlural} (${rows.length}${rows.length === MAX_ROWS_PER_TYPE ? '+' : ''}): ${items}`;
    });
    const drafts = nonEmpty.flatMap(({ rows }) => rows).filter(r => r.status === 'draft').length;
    return (
      `LISTINGS (most recent per type):\n${lines.join('\n')}` +
      (drafts > 0 ? `\n${drafts} draft(s) are not published yet.` : '')
    );
  } catch {
    return 'LISTINGS: could not be read right now.';
  }
}

async function earningsSection(
  supabase: AnySupabaseClient,
  userId: string,
  days: number
): Promise<string> {
  try {
    const since = sinceIso(days);
    const [orders, intents] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.ORDERS)
        .select('entity_title, amount_btc, created_at')
        .eq('seller_id', userId)
        .eq('status', STATUS.ORDERS.PAID)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from(DATABASE_TABLES.PAYMENT_INTENTS)
        .select('amount_btc, intent_kind, created_at')
        .eq('seller_id', userId)
        .eq('status', STATUS.PAYMENT_INTENTS.PAID)
        .gte('created_at', since)
        .limit(200),
    ]);
    const orderRows = (orders.data ?? []) as Array<{
      entity_title: string;
      amount_btc: number;
    }>;
    const intentRows = (intents.data ?? []) as Array<{
      amount_btc: number;
      intent_kind: string;
    }>;
    const orderTotal = orderRows.reduce((n, o) => n + (o.amount_btc || 0), 0);
    const byKind = new Map<string, { count: number; total: number }>();
    for (const i of intentRows) {
      const k = byKind.get(i.intent_kind) ?? { count: 0, total: 0 };
      k.count += 1;
      k.total += i.amount_btc || 0;
      byKind.set(i.intent_kind, k);
    }
    if (orderRows.length === 0 && intentRows.length === 0) {
      return `EARNINGS (last ${days} days): none recorded.`;
    }
    const parts: string[] = [`EARNINGS (last ${days} days):`];
    if (orderRows.length > 0) {
      const top = orderRows
        .slice(0, 5)
        .map(o => `"${o.entity_title}" ${formatBtc(o.amount_btc)}`)
        .join(', ');
      parts.push(`- ${orderRows.length} paid order(s) totaling ${formatBtc(orderTotal)}: ${top}`);
    }
    for (const [kind, agg] of byKind) {
      parts.push(`- ${agg.count} settled ${kind} payment(s) totaling ${formatBtc(agg.total)}`);
    }
    return parts.join('\n');
  } catch {
    return 'EARNINGS: could not be read right now.';
  }
}

async function bookingsSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const actorIds = await fetchActorIds(supabase, userId);
    const now = new Date().toISOString();
    const asProvider =
      actorIds.length > 0
        ? await supabase
            .from(DATABASE_TABLES.BOOKINGS)
            .select('starts_at, status, customer:customer_actor_id(display_name, slug)')
            .in('provider_actor_id', actorIds)
            .in('status', [STATUS.BOOKINGS.CONFIRMED, STATUS.BOOKINGS.PENDING])
            .gte('starts_at', now)
            .order('starts_at', { ascending: true })
            .limit(6)
        : { data: [], error: null };
    const asCustomer =
      actorIds.length > 0
        ? await supabase
            .from(DATABASE_TABLES.BOOKINGS)
            .select('starts_at, status')
            .in('customer_actor_id', actorIds)
            .in('status', [STATUS.BOOKINGS.CONFIRMED, STATUS.BOOKINGS.PENDING])
            .gte('starts_at', now)
            .order('starts_at', { ascending: true })
            .limit(6)
        : { data: [], error: null };

    const provRows = (asProvider.data ?? []) as Array<{
      starts_at: string;
      status: string;
      customer: { display_name: string | null; slug: string | null }[] | null;
    }>;
    const custRows = (asCustomer.data ?? []) as Array<{ starts_at: string; status: string }>;
    if (provRows.length === 0 && custRows.length === 0) {
      return 'BOOKINGS: no upcoming bookings.';
    }
    const parts = ['BOOKINGS (upcoming):'];
    for (const b of provRows) {
      const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;
      const who = customer?.display_name || customer?.slug || 'someone';
      parts.push(`- ${b.starts_at} with ${who} (${b.status}, you provide)`);
    }
    for (const b of custRows) {
      parts.push(`- ${b.starts_at} (${b.status}, you booked)`);
    }
    return parts.join('\n');
  } catch {
    return 'BOOKINGS: could not be read right now.';
  }
}

async function walletsSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .select(
        'label, behavior_type, goal_amount, goal_currency, goal_deadline, budget_amount, budget_period, is_primary, balance_btc, balance_updated_at'
      )
      .eq('profile_id', userId)
      .eq('is_active', true)
      .limit(20);
    if (error) {
      return 'WALLETS: could not be read right now.';
    }
    const rows = (data ?? []) as Array<{
      label: string;
      behavior_type: string | null;
      goal_amount: number | null;
      goal_currency: string | null;
      goal_deadline: string | null;
      budget_amount: number | null;
      budget_period: string | null;
      is_primary: boolean;
      balance_btc: number | null;
      balance_updated_at: string | null;
    }>;
    if (rows.length === 0) {
      return 'WALLETS: none set up yet.';
    }
    const lines = rows.map(w => {
      const bits = [
        `- "${w.label}"${w.is_primary ? ' (primary)' : ''}`,
        typeof w.balance_btc === 'number'
          ? `balance ${formatBtc(w.balance_btc)}`
          : 'balance unknown',
      ];
      if (typeof w.goal_amount === 'number') {
        bits.push(
          `goal ${w.goal_amount} ${w.goal_currency ?? 'BTC'}${w.goal_deadline ? ` by ${w.goal_deadline}` : ''}`
        );
      }
      if (typeof w.budget_amount === 'number') {
        bits.push(`budget ${formatBtc(w.budget_amount)}/${w.budget_period ?? 'period'}`);
      }
      return bits.join(', ');
    });
    return `WALLETS:\n${lines.join('\n')}`;
  } catch {
    return 'WALLETS: could not be read right now.';
  }
}

async function notificationsSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const [count, recentRes] = await Promise.all([
      countUnreadNotifications(supabase, userId),
      supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .select('message, created_at')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if (count === 0) {
      return 'NOTIFICATIONS: all caught up — nothing unread.';
    }
    const lines = ((recentRes.data ?? []) as Array<{ message: string }>).map(n => `- ${n.message}`);
    return `NOTIFICATIONS: ${count} unread. Latest:\n${lines.join('\n')}`;
  } catch {
    return 'NOTIFICATIONS: could not be read right now.';
  }
}

async function tasksSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .select('title, priority, due_date, is_reminder')
      .eq('created_by', userId)
      .eq('is_archived', false)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(8);
    if (error) {
      return 'TASKS: could not be read right now.';
    }
    const rows = (data ?? []) as Array<{
      title: string;
      priority: string | null;
      due_date: string | null;
      is_reminder: boolean;
    }>;
    if (rows.length === 0) {
      return 'TASKS: no open tasks or reminders.';
    }
    const overdue = rows.filter(t => t.due_date && t.due_date < new Date().toISOString()).length;
    const lines = rows.map(
      t =>
        `- ${t.is_reminder ? '⏰ ' : ''}${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}${t.priority && t.priority !== 'normal' ? ` [${t.priority}]` : ''}`
    );
    return (
      `TASKS (${rows.length} open${overdue > 0 ? `, ${overdue} overdue` : ''}):\n` +
      lines.join('\n')
    );
  } catch {
    return 'TASKS: could not be read right now.';
  }
}

async function interestsSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const interests = await listInterests(supabase, userId);
    if (interests.length === 0) {
      return 'PUBLIC INTERESTS: none published. Nothing about their interests is visible to other people.';
    }
    return (
      `PUBLIC INTERESTS (${interests.length}, visible to other signed-in users, findable in topic search):\n` +
      interests.map(i => `- ${i.topic}`).join('\n')
    );
  } catch {
    return 'PUBLIC INTERESTS: could not be read right now.';
  }
}

/**
 * Answer a read-only "my data" question. Returns a compact plain-text report
 * the model paraphrases — never raw JSON, so weak models don't echo it.
 */
export async function queryMyData(
  supabase: AnySupabaseClient,
  userId: string,
  topic: MyDataTopic,
  opts: { days?: number } = {}
): Promise<string> {
  const days =
    typeof opts.days === 'number' && opts.days > 0 && opts.days <= 365
      ? Math.floor(opts.days)
      : DEFAULT_WINDOW_DAYS;

  switch (topic) {
    case 'listings':
      return listingsSection(supabase, userId);
    case 'earnings':
      return earningsSection(supabase, userId, days);
    case 'bookings':
      return bookingsSection(supabase, userId);
    case 'wallets':
      return walletsSection(supabase, userId);
    case 'notifications':
      return notificationsSection(supabase, userId);
    case 'tasks':
      return tasksSection(supabase, userId);
    case 'interests':
      return interestsSection(supabase, userId);
    case 'overview': {
      const sections = await Promise.all([
        listingsSection(supabase, userId),
        earningsSection(supabase, userId, days),
        bookingsSection(supabase, userId),
        walletsSection(supabase, userId),
        notificationsSection(supabase, userId),
        tasksSection(supabase, userId),
        interestsSection(supabase, userId),
      ]);
      return sections.join('\n\n');
    }
  }
}
