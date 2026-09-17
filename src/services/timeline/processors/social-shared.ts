/**
 * Shared internals for timeline social interactions (reactions + comments).
 * Extracted verbatim from socialInteractions.ts (SoC). No behavior change.
 */

import supabase from '@/lib/supabase/browser';

// TIMELINE_LIKES, TIMELINE_DISLIKES, TIMELINE_COMMENTS are not in the generated DB schema,
// and custom RPCs (like/unlike/comment) are also absent — cast required.
export const db = supabase as any;

// Who is reading is an AUTH question, not a timeline one, and there is exactly
// one answer per page. Re-exported rather than redefined: five copies of this
// function used to exist across services, each uncached, each a round-trip.
export {
  getCurrentUserId,
  __resetCurrentUserIdCache,
} from '@/services/supabase/auth/session';
