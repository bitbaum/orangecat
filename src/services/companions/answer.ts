/**
 * One companion answers one transcript.
 *
 * The same door, key, price and memory wherever a companion speaks: in a
 * room of bots (rooms/respond.ts) and in a conversation in Messages
 * (features/messaging/server/bot-seats.ts). What differs between those is
 * only the scene added to its prompt, which the caller writes.
 *
 * Nothing is stored here. The caller stores the line and then calls
 * `settle(messageId)`, so a charge is never taken for a line that was lost.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getAdminClient } from '@/lib/supabase/admin';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { readOwnKey } from '@/services/ai/own-key';
import { sharedLokiOwnKeys } from '@/services/loki/shared-keys';
import {
  checkAffordability,
  computeCreatorChargeBtc,
  settleAssistantCharge,
} from '@/services/ai/assistant-charge';
import { fetchAssistant, generateReply } from '@/services/ai/sendMessage-internals';
import type { SendMessageError } from '@/services/ai/sendMessage-types';
import type { ChatImage } from '@/services/cat/chat-images';
import { decideConversationAccess } from './access';
import { recallCompanionMemories } from './memory';
import { buildCompanionSystemPrompt } from './system-prompt';

export type CompanionAnswerError = SendMessageError | { code: 'NOT_FOUND'; message: string };

export type CompanionAnswer =
  | { content: string; settle: (messageId: string) => Promise<void> }
  | { error: CompanionAnswerError };

const RATE_LIMITED = 'Daily limit reached. Add your own OpenRouter API key for unlimited usage.';

export async function companionAnswer(args: {
  supabase: AnySupabaseClient;
  /** Who asked: their key, their allowance, their credits. */
  userId: string;
  assistantId: string;
  /** The name it goes by here, for the sentences a person reads. */
  name: string;
  /** Ends on the asker's line. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  content: string;
  /** The companion's definition with what it remembers, turned into the
   *  prompt for this place (a room, a conversation). */
  scene: (definition: string | undefined) => string | null;
  images?: ChatImage[];
  /**
   * Bring what the companion remembers about the asker. On by default. Off
   * where other people read the answer: what one person told a companion in
   * private is not said in front of a group.
   */
  recall?: boolean;
}): Promise<CompanionAnswer> {
  const { supabase, userId, name, history, content } = args;
  const fetched = await fetchAssistant(supabase, args.assistantId);
  if ('error' in fetched) {
    return { error: fetched.error };
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
            ? `${name} is not taking conversations right now.`
            : `${name} is not here any more.`,
      },
    };
  }

  const keyService = createApiKeyService(supabase);
  // The person's own key, whichever provider it is from (ai/own-key.ts).
  const onLoki = () => sharedLokiOwnKeys(supabase, userId);
  const { hasByok, userKey, directKey } = await readOwnKey(keyService, userId, onLoki);
  if (!hasByok) {
    const usage = await keyService.checkPlatformUsage(userId);
    if (!usage.can_use_platform) {
      return { error: { code: 'RATE_LIMITED', message: RATE_LIMITED } };
    }
  }

  // The creator's price, pre-authorised before the model is asked. A turn
  // here is never a free message: that daily allowance belongs to the
  // companion's own thread, where it is counted.
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

  // What this companion knows about this person (its job, told in their own
  // thread) comes with it, as it does one to one.
  const recalled =
    args.recall === false
      ? []
      : await recallCompanionMemories(supabase, { assistantId: assistant.id, userId }, content);
  const definition = buildCompanionSystemPrompt({
    definition: assistant.system_prompt,
    memories: recalled.map(m => m.content),
  });
  const reply = await generateReply({
    hasByok,
    userKey,
    directKey,
    requestedModel: undefined,
    assistant,
    images: args.images,
    systemPrompt: args.scene(definition),
    history,
    content,
  });
  if ('error' in reply) {
    return { error: reply.error };
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
