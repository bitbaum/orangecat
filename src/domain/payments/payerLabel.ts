/**
 * How a payer is named to the person they paid: the name they chose to show,
 * else their handle. Null when we cannot say — the caller then falls back to
 * the anonymous wording rather than guess. Never throws: a note about a
 * payment that has already happened must not fail the settlement.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';

export async function payerLabel(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from(DATABASE_TABLES.PROFILES)
      .select('username, display_name:name')
      .eq('id', userId)
      .maybeSingle();
    const row = data as { username?: string | null; display_name?: string | null } | null;
    return row?.display_name?.trim() || row?.username?.trim() || null;
  } catch {
    return null;
  }
}
