/**
 * A room: a group chat between one person and two to six companions.
 *
 * A member is either one of the person's companions (an `ai_assistant` row)
 * or one of the fleet's own bots (a product that answers at `/api/ask`, see
 * `src/config/fleet-bots.ts`). Both are addressed the same way in the room —
 * `@Name` — and both speak with their name over the line.
 */

export type RoomMemberKind = 'companion' | 'fleet';

export interface RoomMember {
  /** The membership row id; a message points at it, not at the companion. */
  id: string;
  kind: RoomMemberKind;
  assistantId: string | null;
  fleetSlug: string | null;
  /** The name shown over the member's lines and matched by `@Name`. */
  name: string;
  /** One line under the name: a companion's description, a product's first sentence. */
  job: string | null;
  avatarUrl: string | null;
  position: number;
}

export interface RoomMessage {
  id: string;
  role: 'user' | 'assistant';
  memberId: string | null;
  /** The member's name when it spoke; survives a rename or a departure. */
  speaker: string | null;
  content: string;
  createdAt: string;
}

export interface RoomSummary {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string | null;
  members: RoomMember[];
}

export interface RoomView extends RoomSummary {
  messages: RoomMessage[];
}

/** What a new room is made of: a title (optional, derived from members) and who sits in it. */
export type NewRoomMember = { assistantId: string } | { fleetSlug: string };

export type RoomTurnError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'RATE_LIMITED'; message: string }
  | { code: 'SERVICE_UNAVAILABLE' }
  | {
      code: 'INSUFFICIENT_CREDITS';
      currentBalance: number;
      requiredAmount: number;
      shortfall: number;
    }
  | { code: 'AI_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string };
