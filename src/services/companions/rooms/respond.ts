/**
 * One member speaks in a room.
 *
 * A companion answers the way it does in its own thread — the creator's
 * definition, the person's own key or the platform chain, the creator's
 * per-message price settled in Cat Credits — with the room section added to
 * its prompt and the room's transcript as its history. A fleet bot answers
 * over the shared `/api/ask` contract. Either way the line is stored with the
 * member it came from and the name it had, and handed back.
 *
 * No memory is written here: what is said in a group is not a confidence
 * between one person and one companion (see the migration).
 */

import { loadChatImages } from '@/services/cat/chat-image-store';
import { imageRefsIn } from '@/lib/chat/attachment-tags';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { companionAnswer, type CompanionAnswerError } from '../answer';
import { askFleetBot, fleetBot } from './fleet';
import { cutImpersonation, stripSelfPrefix } from './plan';
import { buildRoomPrompt, roomScene, splitForModel, transcriptFor } from './prompt';
import { appendRoomMessage } from './store';
import type { RoomMember, RoomMessage, RoomTurnError, RoomView } from './types';

export type RoomTurnOutcome =
  { message: RoomMessage; handoff: RoomMember | null } | { error: RoomTurnError };

export async function speakInRoom(args: {
  supabase: AnySupabaseClient;
  userId: string;
  room: RoomView;
  member: RoomMember;
}): Promise<RoomTurnOutcome> {
  const { supabase, userId, room, member } = args;
  const transcript = transcriptFor(room.messages, member);
  const spoken =
    member.kind === 'fleet'
      ? await fleetLine(member, transcript, room.members)
      : await companionLine({ supabase, userId, room, member, transcript });
  if ('error' in spoken) {
    return spoken;
  }
  if (!spoken.content.trim()) {
    return { error: { code: 'AI_ERROR', message: `${member.name} answered with nothing.` } };
  }
  const cut = cutImpersonation(stripSelfPrefix(spoken.content, member), member, room.members);
  const message = await appendRoomMessage(supabase, room.id, {
    role: 'assistant',
    memberId: member.id,
    speaker: member.name,
    content: cut.text || spoken.content,
  });
  if (spoken.settle) {
    await spoken.settle(message.id);
  }
  return { message, handoff: cut.text ? cut.handoff : null };
}

/** The one-to-one pipeline's errors, in the room's vocabulary (a paused thread is not a room concept). */
function asRoomError(error: CompanionAnswerError): RoomTurnError {
  return error.code === 'ARCHIVED'
    ? { code: 'NOT_FOUND', message: 'This companion is not taking conversations right now.' }
    : error;
}

type Spoken =
  { content: string; settle?: (messageId: string) => Promise<void> } | { error: RoomTurnError };

async function fleetLine(
  member: RoomMember,
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>,
  members: readonly RoomMember[]
): Promise<Spoken> {
  const bot = member.fleetSlug ? await fleetBot(member.fleetSlug) : null;
  if (!bot) {
    return { error: { code: 'NOT_FOUND', message: `${member.name} is not reachable right now.` } };
  }
  // The contract wants the conversation to end on the person's line.
  const { history, content } = splitForModel(transcript);
  // The product's rules live on its site; the room (who else is here, speak
  // as yourself only) goes with the request as the contract's scene.
  const answer = await askFleetBot(bot, [...history, { role: 'user', content }], {
    scene: roomScene(member, members),
  });
  if ('error' in answer) {
    return answer;
  }
  return { content: answer.text };
}

async function companionLine(args: {
  supabase: AnySupabaseClient;
  userId: string;
  room: RoomView;
  member: RoomMember;
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<Spoken> {
  const { supabase, userId, room, member, transcript } = args;
  if (!member.assistantId) {
    return { error: { code: 'NOT_FOUND', message: `${member.name} is not here any more.` } };
  }
  const { history, content } = splitForModel(transcript);
  // The photos on the person's newest line, read back from the store: this
  // member's turn runs in its own request, after the one that carried them.
  const newest = [...room.messages].reverse().find(m => m.role === 'user');
  const refs = newest ? imageRefsIn([newest.content]) : [];
  const images = refs.length ? await loadChatImages(userId, refs) : undefined;
  const answer = await companionAnswer({
    supabase,
    userId,
    assistantId: member.assistantId,
    name: member.name,
    history,
    content,
    images,
    scene: definition => buildRoomPrompt({ speaker: member, members: room.members, definition }),
  });
  return 'error' in answer ? { error: asRoomError(answer.error) } : answer;
}
