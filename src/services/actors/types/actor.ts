/**
 * Actor Types
 *
 * Type definitions for the unified actor system.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created actor types
 */

// 'unclaimed' — a person set up on someone else's behalf: a real identity
// that owns rows and has no auth user, hence no profile and no way to be
// paid until they accept (ADR-0005).
type ActorType = 'user' | 'group' | 'unclaimed';

export interface Actor {
  id: string;
  actor_type: ActorType;
  user_id: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}
