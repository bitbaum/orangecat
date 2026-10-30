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
import { getAdminClient } from '@/lib/supabase/admin';
import { createApiKeyService } from '@/services/ai/api-key-service';
import {
  checkAffordability,
  computeCreatorChargeBtc,
  settleAssistantCharge,
} from '@/services/ai/assistant-charge';
import { fetchAssistant, generateReply } from '@/services/ai/sendMessage-internals';
import type { SendMessageError } from '@/services/ai/sendMessage-types';
import { decideConversationAccess } from '../access';
import { askFleetBot, fleetBot } from './fleet';
import { buildRoomPrompt, splitForModel, transcriptFor } from './prompt';
import { appendRoomMessage } from './store';
import type { RoomMember, RoomMessage, RoomTurnError, RoomView } from './types';

export type RoomTurnOutcome = { message: RoomMessage } | { error: RoomTurnError };

const RATE_LIMITED = 'Daily limit reached. Add your own OpenRouter API key for unlimited usage.';

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
      ? await fleetLine(member, transcript)
      : await companionLine({ supabase, userId, room, member, transcript });
  if ('error' in spoken) {
    return spoken;
  }
  const message = await appendRoomMessage(supabase, room.id, {
    role: 'assistant',
    memberId: member.id,
    speaker: member.name,
    content: spoken.content,
  });
  if (spoken.settle) {
    await spoken.settle(message.id);
  }
  return { message };
}

/** The one-to-one pipeline's errors, in the room's vocabulary (a paused thread is not a room concept). */
function asRoomError(error: SendMessageError): RoomTurnError {
  return error.code === 'ARCHIVED'
    ? { code: 'NOT_FOUND', message: 'This companion is not taking conversations right now.' }
    : error;
}

type Spoken =
  { content: string; settle?: (messageId: string) => Promise<void> } | { error: RoomTurnError };

async function fleetLine(
  member: RoomMember,
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<Spoken> {
  const bot = member.fleetSlug ? await fleetBot(member.fleetSlug) : null;
  if (!bot) {
    return { error: { code: 'NOT_FOUND', message: `${member.name} is not reachable right now.` } };
  }
  // The contract wants the conversation to end on the person's line.
  const { history, content } = splitForModel(transcript);
  const answer = await askFleetBot(bot, [...history, { role: 'user', content }]);
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
  const fetched = await fetchAssistant(supabase, member.assistantId);
  if ('error' in fetched) {
    return { error: asRoomError(fetched.error) };
  }
  const assistant = fetched.assistant;
  // The same door as a one-to-one thread: the owner always, a stranger only
  // while the companion is public and active.
  const { data: access } = await supabase
    .from('ai_assistants')
    .select('status, is_public, user_id')
    .eq('id', assistant.id)
    .maybeSingle();
  const decision = access
    ? decideConversationAccess(
        access as { status: string | null; is_public: boolean | null; user_id: string },
        userId
      )
    : ({ allowed: false, reason: 'not_found' } as const);
  if (!decision.allowed) {
    return {
      error: {
        code: 'NOT_FOUND',
        message:
          decision.reason === 'not_active'
            ? `${member.name} is not taking conversations right now.`
            : `${member.name} is not here any more.`,
      },
    };
  }

  const keyService = createApiKeyService(supabase);
  const userKey = await keyService.getDecryptedKey(userId, 'openrouter');
  const hasByok = !!userKey;
  if (!hasByok) {
    const usage = await keyService.checkPlatformUsage(userId);
    if (!usage.can_use_platform) {
      return { error: { code: 'RATE_LIMITED', message: RATE_LIMITED } };
    }
  }

  // The creator's price, pre-authorised before the model is asked. A room
  // turn is never a free message: that daily allowance belongs to the
  // one-to-one thread, where it is counted.
  const charge = computeCreatorChargeBtc(assistant, false);
  const admin = charge > 0 ? getAdminClient() : null;
  if (admin && charge > 0) {
    const affordable = await checkAffordability(admin, userId, charge);
    if (!affordable.ok) {
      return {
        error: {
          code: 'INSUFFICIENT_CREDITS',
          currentBalance: affordable.balance,
          requiredAmount: charge,
          shortfall: charge - affordable.balance,
        },
      };
    }
  }

  const { history, content } = splitForModel(transcript);
  // The photos on the person's newest line, read back from the store: this
  // member's turn runs in its own request, after the one that carried them.
  const newest = [...room.messages].reverse().find(m => m.role === 'user');
  const refs = newest ? imageRefsIn([newest.content]) : [];
  const images = refs.length ? await loadChatImages(userId, refs) : undefined;
  const reply = await generateReply({
    hasByok,
    userKey,
    requestedModel: undefined,
    assistant,
    images,
    systemPrompt: buildRoomPrompt({
      speaker: member,
      members: room.members,
      definition: assistant.system_prompt,
    }),
    history,
    content,
  });
  if ('error' in reply) {
    return { error: asRoomError(reply.error) };
  }
  const response = reply.response;
  return {
    content: response.content,
    settle: async messageId => {
      if (!hasByok) {
        await keyService.incrementPlatformUsage(userId, 1, response.totalTokens);
      }
      if (admin && charge > 0) {
        await settleAssistantCharge(admin, {
          payerUserId: userId,
          creatorUserId: assistant.user_id,
          assistantId: assistant.id,
          messageId,
          chargeBtc: charge,
          model: response.model,
          totalTokens: response.totalTokens,
        });
      }
    },
  };
}
