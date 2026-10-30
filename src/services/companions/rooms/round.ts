/**
 * A round: what one message from the person sets off, one bot line per call.
 *
 * The API runs ONE member per request and hands the rest of the round back
 * to the client as `RoundState`, which brings it to the next call. That keeps
 * every request short enough for a phone on a bad connection, shows each
 * line the moment it lands, and lets the person stop a round by simply not
 * asking for the next turn. The state is re-checked against the room's
 * members on every call (plan.ts `sanitizeRound`), so nothing in it is trusted.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { nextQueue, planResponders, type RoundState } from './plan';
import { speakInRoom } from './respond';
import { pickResponders } from './router';
import { parseMentions } from './mentions';
import type { RoomMessage, RoomTurnError, RoomView } from './types';

export interface RoundStep {
  /** The line that was spoken, if one was. */
  message: RoomMessage | null;
  /** Who was asked and could not answer, with why; the round goes on without it. */
  failed: { memberId: string; speaker: string; error: RoomTurnError } | null;
  state: RoundState;
}

/** Open a round for the person's message: who speaks, in what order. */
export async function openRound(room: RoomView, text: string): Promise<RoundState> {
  const { members } = room;
  const addressed = parseMentions(text, members);
  const routed =
    !addressed.everyone && addressed.members.length === 0 && members.length > 1
      ? await pickResponders(text, members)
      : undefined;
  return planResponders({ text, members, routed });
}

/** Let the next member in the queue speak, and say who is next after it. */
export async function stepRound(args: {
  supabase: AnySupabaseClient;
  userId: string;
  room: RoomView;
  state: RoundState;
}): Promise<RoundStep> {
  const { supabase, userId, room, state } = args;
  const memberId = state.queue[0];
  const speaker = room.members.find(m => m.id === memberId);
  if (!speaker || state.turnsLeft <= 0) {
    return { message: null, failed: null, state: { queue: [], turnsLeft: state.turnsLeft } };
  }
  const outcome = await speakInRoom({ supabase, userId, room, member: speaker });
  if ('error' in outcome) {
    // A member that cannot answer forfeits its turn; the others still get theirs.
    const rest = nextQueue({ state, speaker, reply: '', members: room.members });
    return {
      message: null,
      failed: { memberId: speaker.id, speaker: speaker.name, error: outcome.error },
      state: rest,
    };
  }
  const next = nextQueue({
    state,
    speaker,
    reply: outcome.message.content,
    members: room.members,
  });
  return { message: outcome.message, failed: null, state: next };
}
