/**
 * Whose clock a planner page reads and writes in: the zone the person set
 * for themselves (Settings → bot rules), else the one their browser reports.
 */
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getBotSettings } from '@/services/companions/rules';
import { isValidTimeZone } from '@/utils/timezone';

export async function plannerZone(
  supabase: AnySupabaseClient,
  userId: string,
  offered: string | null | undefined
): Promise<string | null> {
  const own = (await getBotSettings(supabase, userId).catch(() => null))?.timeZone;
  return own ?? (isValidTimeZone(offered) ? offered : null);
}
