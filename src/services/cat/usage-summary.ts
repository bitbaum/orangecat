/**
 * The reads behind /settings/usage's "what this means" — today's quota, the
 * last seven days of messages, and the week's frontier spend — handed to the
 * pure catUsageMeaning().
 *
 * Every read is best-effort. A week that cannot be read is absent from the
 * page, never "0 messages this week": "could not look" and "nothing happened"
 * are opposite claims, and a usage page that confuses them is the kind that
 * gets called made-up.
 *
 * Reads run on the caller's own client, so RLS scopes them to the person:
 * platform_api_usage has "Users can view own platform usage", and
 * cat_credit_entries is read the same way listCreditEntries reads it.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { HISTORY_INJECTION_LIMIT } from '@/services/cat/conversation-history';
import { readCatQuota, type CatQuota } from '@/services/cat/quota';
import { catUsageMeaning, type UsageMeaning } from '@/services/cat/usage-meaning';
import { logger } from '@/utils/logger';

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export interface CatUsageSummary {
  quota: CatQuota;
  meaning: UsageMeaning;
}

/** YYYY-MM-DD of the UTC day `daysAgo` before `now`. */
function utcDay(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

async function readWeek(
  supabase: AnySupabaseClient,
  userId: string,
  now: Date
): Promise<{ day: string; requests: number }[] | null> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.PLATFORM_API_USAGE)
      .select('usage_date, request_count')
      .eq('user_id', userId)
      .gte('usage_date', utcDay(now, WEEK_DAYS - 1));
    if (error) {
      logger.warn('usage week read failed', { error }, 'CatUsage');
      return null;
    }
    const rows = (data ?? []) as { usage_date: string; request_count: number | null }[];
    return rows.map(r => ({ day: r.usage_date, requests: r.request_count ?? 0 }));
  } catch (err) {
    logger.warn('usage week read threw', { err }, 'CatUsage');
    return null;
  }
}

async function readCreditsWeek(
  supabase: AnySupabaseClient,
  userId: string,
  now: Date
): Promise<{ messages: number; btc: number } | null> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.CAT_CREDIT_ENTRIES)
      .select('amount_btc')
      .eq('user_id', userId)
      .eq('kind', 'usage')
      .gte('created_at', new Date(now.getTime() - WEEK_DAYS * DAY_MS).toISOString());
    if (error) {
      logger.warn('credits week read failed', { error }, 'CatUsage');
      return null;
    }
    const rows = (data ?? []) as { amount_btc: number | string }[];
    // Usage entries are debits (negative); the week's spend is their size.
    const btc = rows.reduce((sum, r) => sum + Math.abs(Number(r.amount_btc) || 0), 0);
    return { messages: rows.length, btc: Math.round(btc * 1e8) / 1e8 };
  } catch (err) {
    logger.warn('credits week read threw', { err }, 'CatUsage');
    return null;
  }
}

export async function readCatUsageSummary(
  supabase: AnySupabaseClient,
  userId: string,
  now = new Date()
): Promise<CatUsageSummary> {
  const [quota, week, creditsWeek] = await Promise.all([
    readCatQuota(supabase, userId),
    readWeek(supabase, userId, now),
    readCreditsWeek(supabase, userId, now),
  ]);
  return {
    quota,
    meaning: catUsageMeaning({
      now,
      tier: quota.tier,
      used: quota.dailyRequests,
      limit: quota.dailyLimit,
      resetInSeconds: quota.resetInSeconds,
      week,
      creditsWeek,
      historyMessages: HISTORY_INJECTION_LIMIT,
    }),
  };
}
