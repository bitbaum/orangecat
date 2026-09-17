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

import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getModelMetadata } from '@/config/ai-models';
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
import {
  verifyConversation,
  fetchAssistant,
  resolveProvider,
  selectModel,
  checkFreeMessageUsage,
  buildMessageHistory,
  callAi,
  createChatService,
  storeUserMessage,
  storeAssistantMessage,
} from './sendMessage-internals';

export type { SendMessageResult, SendMessageError } from './sendMessage-types';

export async function sendAiMessage(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
  convId: string,
  content: string,
  requestedModel?: string
): Promise<SendMessageResult | SendMessageError> {
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

  const provider = resolveProvider(hasByok, userOpenRouterKey);
  if (!provider) {
    return { code: 'SERVICE_UNAVAILABLE' };
  }

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
    .select('role, content')
    .eq('conversation_id', convId)
    // Legacy threads stored the prompt as a system row; the prompt is composed
    // per turn now (with memory), so a stored copy would only go stale.
    .neq('role', 'system')
    .order('created_at', { ascending: true })
    .limit(20);
  const history = (historyData || []) as { role: string; content: string }[];

  // 6. Select model
  const modelToUse = selectModel(provider, hasByok, requestedModel, assistant, history, content);

  // 7. Free message check
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

  // 9. Store user message
  const userMsgResult = await storeUserMessage(supabase, convId, content);
  if ('error' in userMsgResult) {
    return userMsgResult.error;
  }
  const userMessage = userMsgResult.message;

  // 10. Generate AI response. The prompt is the creator's definition plus what
  //     this companion remembers about THIS person — nothing else.
  const memoryKey = { assistantId, userId };
  const recalled = await recallCompanionMemories(supabase, memoryKey, content);
  const systemPrompt = buildCompanionSystemPrompt({
    definition: assistant.system_prompt,
    memories: recalled.map(m => m.content),
  });
  const messages = buildMessageHistory(history, content);
  const aiResult = await callAi(provider, hasByok, userOpenRouterKey, modelToUse, messages, {
    ...assistant,
    system_prompt: systemPrompt ?? null,
  });
  if ('error' in aiResult) {
    // Clean up user message on AI failure
    await supabase
      .from(DATABASE_TABLES.AI_MESSAGES)
      .delete()
      .eq('id', (userMessage as { id: string }).id);
    return aiResult.error;
  }
  const aiResponse = aiResult.response;

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
    hasByok
  );
  if ('error' in aiMsgResult) {
    return aiMsgResult.error;
  }
  const assistantMessage = aiMsgResult.message;

  // 12. Post-message side effects.
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
    aiService: createChatService(provider, hasByok, userOpenRouterKey),
    model: modelToUse,
  });

  await fromTable(supabase, DATABASE_TABLES.AI_CONVERSATIONS)
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId);

  return {
    userMessage,
    assistantMessage: {
      ...assistantMessage,
      model_name:
        (provider === 'openrouter' ? getModelMetadata(modelToUse)?.name : null) || modelToUse,
      is_free_model: aiResponse.isFreeModel,
      used_byok: hasByok,
    },
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
