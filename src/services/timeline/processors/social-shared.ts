/**
 * Shared internals for timeline social interactions (reactions + comments).
 * Extracted verbatim from socialInteractions.ts (SoC). No behavior change.
 */

import supabase from '@/lib/supabase/browser';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export const db: AnySupabaseClient = supabase;

// Who is reading is an AUTH question, not a timeline one, and there is exactly
// one answer per page. Re-exported rather than redefined: five copies of this
// function used to exist across services, each uncached, each a round-trip.
export { getCurrentUserId, __resetCurrentUserIdCache } from '@/services/supabase/auth/session';
