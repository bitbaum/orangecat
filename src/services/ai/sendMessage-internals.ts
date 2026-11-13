/**
 * Internal helpers for the AI assistant message-send pipeline. Extracted verbatim
 * from sendMessage.ts (SoC) — sendAiMessage orchestrates these. No behavior change.
 *
 * NOTE: isAiRateLimitError here intentionally differs from the one in
 * cat/chat-orchestrator.ts (this one also matches `status === 429` and a regex);
 * they are kept separate to preserve each path's exact behavior.
 */

import { withImages, type ChatImage } from '@/services/cat/chat-images';
import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import { createOpenRouterServiceWithByok, type OpenRouterMessage } from './openrouter';
import { DEFAULT_FREE_MODEL_ID, getModelMetadata } from '@/config/ai-models';
import { createAutoRouter } from '@/services/ai/auto-router';
import { completeOnPlatform, PlatformChainExhausted } from '@/services/ai/platform-providers';
import {
  BOT_TURN_LOG_SOURCE,
  SHARED_POOL_DOWN_MESSAGE,
  chainFailureSummary,
} from '@/services/ai/chain-failure-summary';
import { directKeyService } from './own-key-service';
import { chosenModel } from './own-models';
import type { OwnKey } from './own-key';
import type { AiService } from './types';
import type { AssistantRecord, SendMessageError } from './sendMessage-types';
import type { Proposal } from '@/services/companions/hands';
import { GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq-models';
import {
  CONTINUE_INSTRUCTION,
  closeCutOff,
  joinContinuation,
  replyTokenCap,
  wasCutOff,
} from './reply-continuation';

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

/**
 * The model for a person using their OWN OpenRouter key. They pay, so the
 * assistant's preference and the auto-router's pick across its allowed models
 * apply. The platform path does not come through here: the shared chain
 * carries its own models.
 */
export function selectByokModel(
  requestedModel: string | undefined,
  assistant: AssistantRecord,
  history: { role: string; content: string }[],
  content: string
): string {
  let modelToUse = requestedModel || assistant.model_preference || 'auto';
  if (modelToUse === 'auto' || modelToUse === 'any') {
    const allowedModels = assistant.allowed_models?.length ? assistant.allowed_models : undefined;
    modelToUse = createAutoRouter().selectModel({
      message: content,
      conversationHistory: history.map(m => ({ role: m.role, content: m.content })),
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

export interface GeneratedReply {
  response: {
    content: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    isFreeModel: boolean;
    costBtc: number;
  };
  /**
   * The client that produced it. Post-turn memory distillation reuses it, so
   * the facts are distilled by the same vendor that just answered — the one
   * known to be up — rather than one picked again from scratch.
   */
  chatService: AiService;
  /** Human label for the model, as stored and shown. */
  modelLabel: string;
}

/** What a turn on the person's own key says when that key's provider fails. */
function ownKeyError(aiError: unknown): SendMessageError {
  return isAiRateLimitError(aiError)
    ? { code: 'RATE_LIMITED', message: 'Your own API key is rate-limited. Try again shortly.' }
    : {
        code: 'AI_ERROR',
        message: aiError instanceof Error ? aiError.message : 'AI service error',
      };
}

const RATE_LIMITED_MESSAGE =
  'The free AI tier is busy right now. Try again shortly, or add your own API key in Settings → AI for unlimited use.';

/**
 * Produce the assistant's reply.
 *
 * Two paths, and only two:
 *
 * - **Own key (BYOK).** The person pays, so their OpenRouter key and the
 *   assistant's model preference decide. Unchanged.
 * - **Platform.** The shared chain (`completeOnPlatform`) — the same one the Cat
 *   serves from, ordered by capacity with the scarcest pool last. This replaced
 *   a hand-written path that asked OpenRouter's free tier FIRST (50 requests a
 *   day, shared by every app on the box) and fell back one hop, to Groq, only on
 *   a rate limit — so a companion went silent after a handful of messages while
 *   the vendor holding this platform's own quota was never asked.
 *
 * The platform absorbs the model cost of a platform reply (`costBtc: 0`); what
 * the person pays is the creator's own price, charged separately.
 */
export async function generateReply(params: {
  hasByok: boolean;
  userKey: string | null;
  requestedModel: string | undefined;
  assistant: AssistantRecord;
  systemPrompt: string | null;
  history: { role: string; content: string }[];
  content: string;
  /** Photos on this turn; they ride the last user message as image parts. */
  images?: ChatImage[];
  /** The bot's owner is the one talking: room for a long answer (reply-continuation.ts). */
  ownerTurn?: boolean;
  /** The person's own key from a provider other than OpenRouter (own-key.ts). */
  directKey?: OwnKey | null;
}): Promise<GeneratedReply | { error: SendMessageError }> {
  const { assistant, systemPrompt, history, content } = params;
  const messages = withImages(buildMessageHistory(history, content), params.images);
  const temperature = assistant.temperature ?? 0.7;
  const maxTokens = replyTokenCap(assistant.max_tokens_per_response, params.ownerTurn === true);

  if (params.hasByok && params.userKey) {
    const model = selectByokModel(params.requestedModel, assistant, history, content);
    const service = createOpenRouterServiceWithByok(params.userKey);
    try {
      const result = await service.chatCompletion({
        model,
        // A photo rides the last turn as image parts; the client serialises
        // messages as given, and OpenRouter takes OpenAI-style parts.
        messages: messages as unknown as OpenRouterMessage[],
        systemPrompt: systemPrompt || undefined,
        temperature,
        maxTokens,
      });
      const whole = await finishCutOffReply(
        result,
        more =>
          service.chatCompletion({
            model,
            messages: more as unknown as OpenRouterMessage[],
            systemPrompt: systemPrompt || undefined,
            temperature,
            maxTokens,
          }),
        messages
      );
      return {
        response: { ...whole, costBtc: whole.costBtc ?? 0 },
        chatService: service as unknown as AiService,
        modelLabel: getModelMetadata(model)?.name || model,
      };
    } catch (aiError: unknown) {
      logger.error('AI API error (own key)', aiError, 'AIMessagesService');
      return { error: ownKeyError(aiError) };
    }
  }

  const direct = params.directKey ? directKeyService(params.directKey) : null;
  if (direct) {
    // Their own key at their own provider. The system prompt travels as the
    // first message, as on the platform chain: every OpenAI-compatible vendor
    // accepts that, and not every client takes a separate field.
    const withSystem = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
      : messages;
    // The model the person chose for this chat, on their own key; else the
    // provider's default (own-models.ts). A name the provider does not know
    // is the provider's error, said as one.
    const directModel = chosenModel(params.requestedModel, direct.model);
    const ask = (turns: typeof withSystem) =>
      direct.service.chatCompletion({
        model: directModel,
        messages: turns,
        temperature,
        maxTokens,
      });
    try {
      const first = await ask(withSystem);
      const whole = await finishCutOffReply(
        first,
        more =>
          ask(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }, ...more] : more),
        messages
      );
      return {
        response: { ...whole, costBtc: whole.costBtc ?? 0 },
        chatService: direct.service,
        // A key on Loki with nothing chosen here: the name is the one Loki answered on.
        modelLabel: getModelMetadata(directModel)?.name || directModel || whole.model,
      };
    } catch (aiError: unknown) {
      logger.error('AI API error (own key)', aiError, 'AIMessagesService');
      return { error: ownKeyError(aiError) };
    }
  }

  try {
    // Groq's per-minute budget counts the reserved output, so its cap stays
    // where the chain was measured to fit; every other link gets the full room.
    const capFor = (providerId: string) =>
      providerId === 'groq' && maxTokens ? Math.min(maxTokens, GROQ_CHAT_MAX_TOKENS) : maxTokens;
    const { result: first, provider } = await completeOnPlatform(content, {
      systemPrompt,
      messages,
      temperature,
      maxTokens,
      maxTokensFor: capFor,
    });
    const result = await finishCutOffReply(
      first,
      more =>
        provider.aiService.chatCompletion({
          model: provider.defaultModel,
          messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...more] : more,
          temperature,
          maxTokens: capFor(provider.providerId),
        }),
      messages
    );
    return {
      response: { ...result, costBtc: 0 },
      chatService: provider.aiService,
      modelLabel: getModelMetadata(provider.defaultModel)?.name || provider.defaultModel,
    };
  } catch (aiError: unknown) {
    if (aiError instanceof PlatformChainExhausted && aiError.failures.length === 0) {
      return { error: { code: 'SERVICE_UNAVAILABLE' } };
    }
    logger.error('AI API error (platform chain exhausted)', aiError, 'AIMessagesService');
    // Which link failed how, as provider and HTTP status only: what
    // scripts/diagnose-cat-logs.mjs may print in a public run log. On
    // 2026-11-12 every bot send failed for hours and that summary read
    // "0 failures", because it counted the Cat's turns and nothing else.
    if (aiError instanceof PlatformChainExhausted) {
      logger.warn(
        'bot turn: no link of the shared pool answered',
        { links: chainFailureSummary(aiError.failures) },
        BOT_TURN_LOG_SOURCE
      );
    }
    const rationed = aiError instanceof PlatformChainExhausted && aiError.allRateLimited;
    return {
      error: rationed
        ? { code: 'RATE_LIMITED', message: RATE_LIMITED_MESSAGE }
        : { code: 'AI_ERROR', message: SHARED_POOL_DOWN_MESSAGE, sharedPool: true },
    };
  }
}

type Completion = Awaited<ReturnType<AiService['chatCompletion']>>;

/**
 * A reply the output cap cut is continued once on the model that wrote it,
 * and the halves joined; one that is still cut ends at its last finished
 * sentence with the way to get the rest (reply-continuation.ts). A failed
 * continuation never fails the turn: the first half is closed the same way.
 */
export async function finishCutOffReply<M extends { role: string; content: unknown }>(
  first: Completion,
  complete: (
    messages: Array<M | { role: 'assistant' | 'user'; content: string }>
  ) => Promise<Completion>,
  messages: M[]
): Promise<Completion> {
  if (!wasCutOff(first.finishReason) || !first.content.trim()) {
    return first;
  }
  let rest: Completion | null = null;
  try {
    rest = await complete([
      ...messages,
      { role: 'assistant', content: first.content },
      { role: 'user', content: CONTINUE_INSTRUCTION },
    ]);
  } catch (error) {
    logger.warn('reply continuation failed', { error }, 'AIMessagesService');
  }
  if (!rest || !rest.content.trim()) {
    return { ...first, content: closeCutOff(first.content), finishReason: 'length' };
  }
  const joined = joinContinuation(first.content, rest.content);
  const stillCut = wasCutOff(rest.finishReason);
  logger.info(
    'reply continued after the output cap',
    {
      model: first.model,
      firstTokens: first.outputTokens,
      restTokens: rest.outputTokens,
      stillCut,
    },
    'AIMessagesService'
  );
  return {
    ...first,
    content: stillCut ? closeCutOff(joined) : joined,
    inputTokens: first.inputTokens + rest.inputTokens,
    outputTokens: first.outputTokens + rest.outputTokens,
    totalTokens: first.totalTokens + rest.totalTokens,
    costBtc: (first.costBtc ?? 0) + (rest.costBtc ?? 0),
    finishReason: stillCut ? 'length' : 'stop',
  };
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
  hasByok: boolean,
  /** The proposal the reply ended with, when one was queued: kept so the next turn's history shows it. */
  proposal: Proposal | null = null
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
        ...(proposal ? { proposal } : {}),
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
