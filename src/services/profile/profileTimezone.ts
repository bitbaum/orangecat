/**
 * The zone a person keeps time in — their profile choice, else null. One
 * lookup shared by every writer that must read "today 19:00" the way the
 * person meant it (the Cat's event draft, the date line in its context).
 * Null, not UTC: the caller knows whether a venue can say better.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { isValidTimeZone } from '@/utils/timezone';

export async function getProfileTimezone(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  return isValidTimeZone(data?.timezone) ? data.timezone : null;
}
