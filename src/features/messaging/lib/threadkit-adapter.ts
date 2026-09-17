/**
 * The seam between OrangeCat's Supabase rows and threadkit's domain model.
 *
 * threadkit owns the *decisions* — who may read, who has read, what is unread,
 * how an optimistic bubble reconciles with its stored row. It owns no storage,
 * so this file is the whole of the coupling: rows in, threadkit types out.
 *
 * Two mappings below are judgement calls rather than mechanical translation,
 * and both would silently change what users see if taken from the defaults.
 * They are commented where they happen.
 */

import type { Message as ThreadMessage, Participant as ThreadParticipant, Thread } from 'threadkit';

import type { Message, Participant } from '../types';

/**
 * Where the optimistic bubble's client id rides.
 *
 * `messages.metadata` is already a jsonb column that survives the round trip,
 * so correlating a sent message with its stored row needs no migration. That
 * matters: the alternative is a new column on a hot table for what is really a
 * transport concern.
 */
export const CLIENT_ID_METADATA_KEY = 'client_id';

/** The client id a message was sent with, if it carries one. */
export function clientIdOf(message: Message): string | undefined {
  const raw = message.metadata?.[CLIENT_ID_METADATA_KEY];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

export function toThreadMessage(message: Message): ThreadMessage {
  return {
    id: message.id,
    threadId: message.conversation_id,
    authorId: message.sender_id,
    body: message.content,
    createdAt: new Date(message.created_at),
    clientId: clientIdOf(message),
  };
}

export function toThreadParticipant(participant: Participant): ThreadParticipant {
  return {
    actorId: participant.user_id,
    kind: 'human',
    role: participant.role,
    joinedAt: new Date(participant.joined_at),

    // DECISION 1 — history is shared, so visibility starts at the beginning.
    //
    // threadkit defaults `visibleFrom` to `joinedAt`, which is the right default
    // for a clinical thread where adding a second clinician must not hand them
    // everything said before. OrangeCat is a group chat: everyone in a
    // conversation can scroll to the top, and that is the product. Taking the
    // default here would retroactively hide history that people can read today.
    visibleFrom: 'thread-start',

    // DECISION 2 — an inactive participant loses their voice, not their history.
    //
    // The row records only `is_active`, never *when* they left, so there is no
    // honest upper bound to give `leftAt`. Supplying one would be a guess that
    // either hides messages they legitimately saw (bound too early) or shows
    // them ones they should not (bound too late). Blocking writes is the part we
    // can state truthfully from the data we actually have.
    canWrite: participant.is_active,

    lastReadAt: participant.last_read_at ? new Date(participant.last_read_at) : null,
  };
}

/**
 * A thread is a conversation id plus its participants. Messages are passed
 * separately to every threadkit function, so they are deliberately not held here.
 */
export function toThread(conversationId: string, participants: Participant[]): Thread {
  return {
    id: conversationId,
    participants: participants.map(toThreadParticipant),
    createdAt: new Date(0),
  };
}
