/**
 * Who may start a conversation with a companion — one pure rule, tested.
 *
 * A private companion (`is_public = false`) is the owner's alone, in any
 * lifecycle status: the person who made her can always talk to her. Everyone
 * else needs her public AND active. A stranger is told "not found", not
 * "private" — the existence of a private companion is itself private.
 */

import { STATUS } from '@/config/database-constants';

export interface CompanionAccessRow {
  status: string | null;
  is_public: boolean | null;
  user_id: string;
}

export type CompanionAccessDecision =
  { allowed: true; asOwner: boolean } | { allowed: false; reason: 'not_found' | 'not_active' };

export function decideConversationAccess(
  companion: CompanionAccessRow,
  requesterId: string
): CompanionAccessDecision {
  if (companion.user_id === requesterId) {
    return { allowed: true, asOwner: true };
  }
  if (!companion.is_public) {
    return { allowed: false, reason: 'not_found' };
  }
  if (companion.status !== STATUS.AI_ASSISTANTS.ACTIVE) {
    return { allowed: false, reason: 'not_active' };
  }
  return { allowed: true, asOwner: false };
}
