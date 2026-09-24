/**
 * THE unread-notification count. The bell badge, the notification centre, the
 * Cat's openers and context, the Cat's morning brief and its "my data" tool
 * all state this number to the same person — so they read it from one query.
 *
 * Before this existed the bell said "9+", the centre said 80 and the Cat said
 * 30: the Cat summed the 30 newest rows it had fetched for coalescing and
 * reported that sum as the total. Every type counts, including message
 * notifications, because the bell counts them.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** Exact unread count for one user. Throws on a read error — callers decide. */
export async function countUnreadNotifications(
  supabase: AnySupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(DATABASE_TABLES.NOTIFICATIONS)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) {
    throw error;
  }
  return count ?? 0;
}
