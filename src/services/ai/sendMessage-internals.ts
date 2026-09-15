/**
 * Internal helpers for the AI assistant message-send pipeline. Extracted verbatim
 * from sendMessage.ts (SoC) — sendAiMessage orchestrates these. No behavior change.
 *
 * NOTE: isAiRateLimitError here intentionally differs from the one in
 * cat/chat-orchestrator.ts (this one also matches `status === 429` and a regex);
 * they are kept separate to preserve each path's exact behavior.
 */

import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import {
  createOpenRouterService,
  createOpenRouterServiceWithByok,
  type OpenRouterMessage,
} from './openrouter';
import { createGroqService, isGroqAvailable, DEFAULT_GROQ_MODEL, type GroqMessage } from './groq';
import {
  DEFAULT_FREE_MODEL_ID,
  isModelFree,
  getModelMetadata,
  getFreeModels,
} from '@/config/ai-models';
import { createAutoRouter } from '@/services/ai/auto-router';
import type { AIProvider, AssistantRecord, SendMessageError } from './sendMessage-types';

export async function verifyConversation(
  supabase: SupabaseClient,
  convId: string,
  assistantId: string,
  userId: string
): Promise<{ ok: true } | { error: SendMessageError }> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.AI_CONVERSATIONS)
    .select('id, status')
    .eq('id', convId)
    .eq('assistant_id', assistantId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { error: { code: 'NOT_FOUND', message: 'Conversation not found' } };
  }
  const conv = data as { id: string; status: string };
  if (conv.status !== STATUS.AI_ASSISTANTS.ACTIVE) {
    return { error: { code: 'ARCHIVED' } };
  }
  return { ok: true };
}

export async function fetchAssistant(
  supabase: SupabaseClient,
  assistantId: string
): Promise<{ assistant: AssistantRecord } | { error: SendMessageError }> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select(
      'id, title, system_prompt, welcome_message, pricing_model, price_per_message, price_per_1k_tokens, user_id, model_preference, allowed_models, min_model_tier, temperature, max_tokens_per_response, free_messages_per_day'
    )
    .eq('id', assistantId)
    .single();

  if (error || !data) {
    return { error: { code: 'NOT_FOUND', message: 'Assistant not found' } };
  }
  return { assistant: data as AssistantRecord };
}

export function resolveProvider(hasByok: boolean, userKey: string | null): AIProvider | null {
  if (userKey) {
    return 'openrouter';
  }
  if (process.env.OPENROUTER_API_KEY) {
    return 'openrouter';
  }
  if (isGroqAvailable()) {
    return 'groq';
  }
  return null;
}

export function selectModel(
  provider: AIProvider,
  hasByok: boolean,
  requestedModel: string | undefined,
  assistant: AssistantRecord,
  history: { role: string; content: string }[],
  content: string
): string {
  if (provider === 'groq') {
    return DEFAULT_GROQ_MODEL;
  }

  let modelToUse = requestedModel || assistant.model_preference || 'auto';
  const historyMapped = history.map(m => ({ role: m.role, content: m.content }));

  if (!hasByok) {
    if (modelToUse === 'auto' || modelToUse === 'any' || !isModelFree(modelToUse)) {
      const freeModelIds = getFreeModels().map(m => m.id);
      modelToUse = createAutoRouter().selectModel({
        message: content,
        conversationHistory: historyMapped,
        allowedModels: freeModelIds,
      }).model;
    }
  } else if (modelToUse === 'auto' || modelToUse === 'any') {
    const allowedModels = assistant.allowed_models?.length ? assistant.allowed_models : undefined;
    modelToUse = createAutoRouter().selectModel({
      message: content,
      conversationHistory: historyMapped,
      allowedModels,
    }).model;
  }

  return getModelMetadata(modelToUse) ? modelToUse : DEFAULT_FREE_MODEL_ID;
}

export async function checkFreeMessageUsage(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
  freeMessagesPerDay: number
): Promise<{ usesFreeMessage: boolean; freeMessagesRemaining: number }> {
  if (freeMessagesPerDay <= 0) {
    return { usesFreeMessage: false, freeMessagesRemaining: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: userConvosData } = await supabase
    .from(DATABASE_TABLES.AI_CONVERSATIONS)
    .select('id')
    .eq('assistant_id', assistantId)
    .eq('user_id', userId);
  const convoIds = (userConvosData as { id: string }[] | null)?.map(c => c.id) || [];

  if (convoIds.length === 0) {
    return { usesFreeMessage: true, freeMessagesRemaining: freeMessagesPerDay };
  }

  const { count: todayCount } = await supabase
    .from(DATABASE_TABLES.AI_MESSAGES)
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', convoIds)
    .eq('role', 'user')
    .gte('created_at', today.toISOString());

  const remaining = Math.max(0, freeMessagesPerDay - (todayCount || 0));
  return { usesFreeMessage: remaining > 0, freeMessagesRemaining: remaining };
}

export function buildMessageHistory(history: { role: string; content: string }[], content: string) {
  return [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
    { role: 'user' as const, content },
  ];
}

/**
 * The chat service for a resolved provider. Shared by the turn itself and by
 * the post-turn memory distillation, so both talk to the same vendor.
 */
export function createChatService(
  provider: AIProvider,
  hasByok: boolean,
  userKey: string | null
): { chatCompletion: ReturnType<typeof createOpenRouterService>['chatCompletion'] } {
  if (provider === 'groq') {
    return createGroqService() as unknown as {
      chatCompletion: ReturnType<typeof createOpenRouterService>['chatCompletion'];
    };
  }
  return hasByok ? createOpenRouterServiceWithByok(userKey!) : createOpenRouterService();
}

export async function callAi(
  provider: AIProvider,
  hasByok: boolean,
  userKey: string | null,
  modelToUse: string,
  messages: (OpenRouterMessage | GroqMessage)[],
  assistant: AssistantRecord
): Promise<
  | {
      response: {
        content: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        isFreeModel: boolean;
        costBtc: number;
      };
    }
  | { error: SendMessageError }
> {
  try {
    if (provider === 'groq') {
      const result = await createGroqService().chatCompletion({
        model: modelToUse,
        messages: messages as GroqMessage[],
        systemPrompt: assistant.system_prompt || undefined,
        temperature: assistant.temperature ?? 0.7,
        maxTokens: assistant.max_tokens_per_response || undefined,
      });
      return { response: { ...result, costBtc: 0 } };
    } else {
      const openRouter = hasByok
        ? createOpenRouterServiceWithByok(userKey!)
        : createOpenRouterService();
      const result = await openRouter.chatCompletion({
        model: modelToUse,
        messages: messages as OpenRouterMessage[],
        systemPrompt: assistant.system_prompt || undefined,
        temperature: assistant.temperature ?? 0.7,
        maxTokens: assistant.max_tokens_per_response || undefined,
      });
      return { response: result };
    }
  } catch (aiError: unknown) {
    // The platform-free OpenRouter tier frequently 429s. Rather than fail the whole
    // chat, fall back to Groq (platform key) for non-BYOK users — mirrors the Cat path.
    if (provider === 'openrouter' && !hasByok && isAiRateLimitError(aiError) && isGroqAvailable()) {
      try {
        const result = await createGroqService().chatCompletion({
          model: DEFAULT_GROQ_MODEL,
          messages: messages as GroqMessage[],
          systemPrompt: assistant.system_prompt || undefined,
          temperature: assistant.temperature ?? 0.7,
          maxTokens: assistant.max_tokens_per_response || undefined,
        });
        return { response: { ...result, costBtc: 0 } };
      } catch (groqError: unknown) {
        logger.error(
          'Groq fallback after OpenRouter rate-limit also failed',
          groqError,
          'AIMessagesService'
        );
      }
    }
    logger.error('AI API error', aiError, 'AIMessagesService');
    const isRateLimited = isAiRateLimitError(aiError);
    return {
      error: isRateLimited
        ? {
            code: 'RATE_LIMITED',
            message:
              'The free AI tier is busy right now. Try again shortly, or add your own API key in Settings → AI for unlimited use.',
          }
        : {
            code: 'AI_ERROR',
            message: aiError instanceof Error ? aiError.message : 'AI service error',
          },
    };
  }
}

/** Detect provider rate-limit errors (OpenRouter 429 / Groq TPM) across error shapes. */
export function isAiRateLimitError(error: unknown): boolean {
  const e = error as { statusCode?: number; status?: number; type?: string; message?: string };
  return (
    e?.statusCode === 429 ||
    e?.status === 429 ||
    e?.type === 'rate_limit' ||
    /rate.?limit|429|too many requests/i.test(e?.message ?? '')
  );
}

export async function storeUserMessage(
  supabase: SupabaseClient,
  convId: string,
  content: string
): Promise<{ message: Record<string, unknown> } | { error: SendMessageError }> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.AI_MESSAGES)
    .insert({
      conversation_id: convId,
      role: 'user',
      content,
      tokens_used: Math.ceil(content.length / 4),
      cost_btc: 0,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error storing user message', error, 'AIMessagesService');
    return { error: { code: 'DB_ERROR', message: 'Failed to store message' } };
  }
  return { message: data as Record<string, unknown> };
}

export async function storeAssistantMessage(
  supabase: SupabaseClient,
  convId: string,
  aiResponse: {
    content: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    isFreeModel: boolean;
    costBtc: number;
  },
  assistant: AssistantRecord,
  creatorMarkupBtc: number,
  apiCostBtc: number,
  hasByok: boolean
): Promise<{ message: Record<string, unknown> } | { error: SendMessageError }> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.AI_MESSAGES)
    .insert({
      conversation_id: convId,
      role: 'assistant',
      content: aiResponse.content,
      tokens_used: aiResponse.totalTokens,
      cost_btc: apiCostBtc + creatorMarkupBtc,
      api_cost_btc: apiCostBtc,
      creator_markup_btc: creatorMarkupBtc,
      model_used: aiResponse.model,
      metadata: {
        pricing_model: assistant.pricing_model,
        used_byok: hasByok,
        is_free_model: aiResponse.isFreeModel,
        input_tokens: aiResponse.inputTokens,
        output_tokens: aiResponse.outputTokens,
      },
    })
    .select()
    .single();

  if (error) {
    logger.error('Error storing AI message', error, 'AIMessagesService');
    return { error: { code: 'DB_ERROR', message: 'Failed to store AI response' } };
  }
  return { message: data as Record<string, unknown> };
}
