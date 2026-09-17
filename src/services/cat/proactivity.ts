/**
 * May Cat raise something the user did not ask about?
 *
 * Two things had to be true before this was worth building. Cat should
 * sometimes volunteer — a draft nobody can find, an entity nothing can pay
 * into — because an agent that only ever answers is a search box with manners.
 * And it must be switchable per person, because unasked suggestions are the
 * fastest way to make a product tiring.
 *
 * The switch is the easy half. The hard half is the BAR, and that lives in the
 * prompt (`Proactive Suggestions`) rather than here, because "is this worth
 * interrupting someone for" is a judgement, not a boolean.
 *
 * Reads `user_ai_preferences.proactive_suggestions_enabled`, mirroring
 * `memoryConsentGranted` in memory.ts down to the failure posture: a missing
 * row or a failed read returns the DEFAULT rather than silently flipping
 * behaviour, because a database hiccup must not quietly change what Cat does.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';

/**
 * On unless someone turns it off.
 *
 * An opt-IN default means almost nobody ever sees the behaviour, so it never
 * gets better and never earns its keep. Flip this one constant to change the
 * product's mind.
 */
export const PROACTIVITY_DEFAULT = true;

export async function proactivityEnabled(
  supabase: AnySupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from(DATABASE_TABLES.USER_AI_PREFERENCES)
      .select('proactive_suggestions_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    const value = (data as { proactive_suggestions_enabled?: boolean } | null)
      ?.proactive_suggestions_enabled;
    return value === undefined || value === null ? PROACTIVITY_DEFAULT : value;
  } catch {
    return PROACTIVITY_DEFAULT;
  }
}
