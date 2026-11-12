/**
 * AI Message Send Service
 *
 * Core business logic for the AI conversation message flow:
 * validate access → select model → call AI → store messages → charge/track.
 * Extracted from /api/ai-assistants/[id]/conversations/[convId]/messages.
 *
 * This file is the thin orchestrator (sendAiMessage); the pipeline steps live in
 * sendMessage-internals.ts and the shared types in sendMessage-types.ts.
 */

import type { ChatImage } from '@/services/cat/chat-images';
import { storeChatImages } from '@/services/cat/chat-image-store';
import { withImageRefs } from '@/lib/chat/attachment-tags';
import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createApiKeyService } from './api-key-service';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  computeCreatorChargeBtc,
  checkAffordability,
  settleAssistantCharge,
} from '@/services/ai/assistant-charge';
import type { SendMessageResult, SendMessageError } from './sendMessage-types';
import { recallCompanionMemories, extractCompanionMemories } from '@/services/companions/memory';
import { buildCompanionSystemPrompt } from '@/services/companions/system-prompt';
import { adoptJob, isJobAnswer } from '@/services/companions/born';
import { proposalFromMetadata, withProposal } from '@/services/companions/hands';
import { handsFor, proposeFromReply } from '@/services/companions/hands-server';
import { logger } from '@/utils/logger';
import { turnTimer } from './turn-timer';
import {
  verifyConversation,
  fetchAssistant,
  checkFreeMessageUsage,
  generateReply,
  storeUserMessage,
  storeAssistantMessage,
} from './sendMessage-internals';

type HistoryRow = { role: string; content: string; metadata?: unknown };

export type { SendMessageResult, SendMessageError } from './sendMessage-types';

export async function sendAiMessage(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
  convId: string,
  content: string,
  requestedModel?: string,
  /** Photos on this turn (the message carries their tags; see chat-images.ts). */
  images?: ChatImage[]
): Promise<SendMessageResult | SendMessageError> {
  const timer = turnTimer();
  // 1. Verify conversation
  const convResult = await verifyConversation(supabase, convId, assistantId, userId);
  if ('error' in convResult) {
    return convResult.error;
  }

  // 2. Fetch assistant
  const assistantResult = await fetchAssistant(supabase, assistantId);
  if ('error' in assistantResult) {
    return assistantResult.error;
  }
  const assistant = assistantResult.assistant;

  // 3. Determine provider + BYOK
  const keyService = createApiKeyService(supabase);
  const userOpenRouterKey = await keyService.getDecryptedKey(userId, 'openrouter');
  const hasByok = !!userOpenRouterKey;

  // 4. Check platform usage limits (non-BYOK users)
  if (!hasByok) {
    const platformUsage = await keyService.checkPlatformUsage(userId);
    if (!platformUsage.can_use_platform) {
      return {
        code: 'RATE_LIMITED',
        message: 'Daily limit reached. Add your own OpenRouter API key for unlimited usage.',
      };
    }
  }

  // 5. Get conversation history
  const { data: historyData } = await supabase
    .from(DATABASE_TABLES.AI_MESSAGES)
    .select('role, content, metadata')
    .eq('conversation_id', convId)
    // Legacy threads stored the prompt as a system row; the prompt is composed
    // per turn now (with memory), so a stored copy would only go stale.
    .neq('role', 'system')
    .order('created_at', { ascending: true })
    .limit(20);
  // A stored turn is the words the person saw; the model is shown the fence
  // it wrote too, or it learns from its own history to stop proposing.
  const history = ((historyData || []) as HistoryRow[]).map(row => {
    const proposal = row.role === 'assistant' ? proposalFromMetadata(row.metadata) : null;
    return {
      role: row.role,
      content: proposal ? withProposal(row.content, proposal) : row.content,
    };
  });

  // 6. Free message check
  const freeMessagesPerDay = assistant.free_messages_per_day || 0;
  const { usesFreeMessage, freeMessagesRemaining } = await checkFreeMessageUsage(
    supabase,
    userId,
    assistantId,
    freeMessagesPerDay
  );

  // 8. Compute the creator's per-message charge (BTC) and pre-authorize it against the
  //    user's Cat Credits balance BEFORE calling the model, so we can return a clean
  //    INSUFFICIENT_CREDITS without serving a message. Free messages / non-per_message
  //    pricing cost nothing (see assistant-charge.ts).
  const creatorCharge = computeCreatorChargeBtc(assistant, usesFreeMessage);
  const admin = creatorCharge > 0 ? getAdminClient() : null;
  if (admin && creatorCharge > 0) {
    const affordability = await checkAffordability(admin, userId, creatorCharge);
    if (!affordability.ok) {
      return {
        code: 'INSUFFICIENT_CREDITS',
        currentBalance: affordability.balance,
        requiredAmount: creatorCharge,
        shortfall: creatorCharge - affordability.balance,
      };
    }
  }

  // 9. Store user message, with each photo's private path in its tag so a
  //    reload shows what was sent and a later turn can read it again.
  const refs = images?.length ? await storeChatImages(userId, images) : [];
  const userMsgResult = await storeUserMessage(
    supabase,
    convId,
    withImageRefs(
      content,
      refs.filter((r): r is string => Boolean(r))
    )
  );
  if ('error' in userMsgResult) {
    return userMsgResult.error;
  }
  const userMessage = userMsgResult.message;

  // 10. Generate AI response. The prompt is the creator's definition plus what
  //     this companion remembers about THIS person — nothing else.
  const memoryKey = { assistantId, userId };
  timer.mark('checks');
  // Memory and hands do not depend on each other: both are read at once.
  // Hands: the owner's own companion may propose what OrangeCat can do for
  // them (hands.ts); anyone else's companion, or a stranger's chat, cannot.
  const [recalled, hands] = await Promise.all([
    recallCompanionMemories(supabase, memoryKey, content),
    assistant.user_id === userId ? handsFor(supabase, userId) : Promise.resolve(null),
  ]);
  timer.mark('context');
  const systemPrompt = buildCompanionSystemPrompt({
    definition: assistant.system_prompt,
    memories: recalled.map(m => m.content),
    hands: hands?.section,
  });
  const aiResult = await generateReply({
    hasByok,
    userKey: userOpenRouterKey,
    requestedModel,
    assistant,
    systemPrompt: systemPrompt ?? null,
    history,
    content,
    images,
    ownerTurn: assistant.user_id === userId,
  });
  // The reply is not streamed, so the model's whole answer is the wait for
  // its first word: this is the time to first token the person feels.
  timer.mark('model');
  if ('error' in aiResult) {
    // Clean up user message on AI failure
    await supabase
      .from(DATABASE_TABLES.AI_MESSAGES)
      .delete()
      .eq('id', (userMessage as { id: string }).id);
    return aiResult.error;
  }
  // A proposal rides the end of the reply as a fence; it comes off before
  // the words are stored, spoken or remembered, and becomes a pending action.
  const proposed = hands
    ? await proposeFromReply(supabase, userId, hands, aiResult.response.content, convId)
    : null;
  const aiResponse = proposed
    ? { ...aiResult.response, content: proposed.text }
    : aiResult.response;

  // 11. Store AI response
  const apiCostBtc = aiResponse.costBtc;
  const totalCostBtc = apiCostBtc + creatorCharge;
  const aiMsgResult = await storeAssistantMessage(
    supabase,
    convId,
    aiResponse,
    assistant,
    creatorCharge,
    apiCostBtc,
    hasByok,
    proposed?.proposal ?? null
  );
  if ('error' in aiMsgResult) {
    return aiMsgResult.error;
  }
  const assistantMessage = aiMsgResult.message;

  // 12. Post-message side effects. The owner's first answer to a born
  //     companion's question becomes the companion's definition (born.ts).
  if (isJobAnswer(assistant, userId, history)) {
    await adoptJob(supabase, assistant, content);
  }
  if (!hasByok) {
    await keyService.incrementPlatformUsage(userId, 1, aiResponse.totalTokens);
  }

  // 12b. Settle the charge: debit the payer's Cat Credits, credit the creator's share.
  //      Pre-authorized in step 8; idempotent on the assistant message id.
  if (admin && creatorCharge > 0) {
    await settleAssistantCharge(admin, {
      payerUserId: userId,
      creatorUserId: assistant.user_id,
      assistantId: assistant.id,
      messageId: (assistantMessage as { id: string }).id,
      chargeBtc: creatorCharge,
      model: aiResponse.model,
      totalTokens: aiResponse.totalTokens,
    });
  }

  // 12c. Remember. Detached: a memory failure must never fail a served turn.
  void extractCompanionMemories(supabase, {
    ...memoryKey,
    conversationId: convId,
    userMessage: content,
    assistantMessage: aiResponse.content,
    aiService: aiResult.chatService,
    model: aiResponse.model,
  });

  await fromTable(supabase, DATABASE_TABLES.AI_CONVERSATIONS)
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId);

  timer.mark('store');
  logger.info(
    'companion turn timing',
    {
      assistantId,
      ...timer.report(),
      model: aiResponse.model,
      outputTokens: aiResponse.outputTokens,
      promptChars: systemPrompt?.length ?? 0,
      hands: hands?.allowed.length ?? 0,
    },
    'AIMessagesService'
  );

  return {
    userMessage,
    assistantMessage: {
      ...assistantMessage,
      model_name: aiResult.modelLabel,
      is_free_model: aiResponse.isFreeModel,
      used_byok: hasByok,
    },
    ...(proposed?.pendingAction ? { pendingAction: proposed.pendingAction } : {}),
    usage: {
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      totalTokens: aiResponse.totalTokens,
      apiCostBtc,
      totalCostBtc,
    },
    userStatus: {
      hasByok,
      usedFreeMessage: usesFreeMessage,
      freeMessagesRemaining: usesFreeMessage ? freeMessagesRemaining - 1 : freeMessagesRemaining,
      freeMessagesPerDay,
    },
  };
}
