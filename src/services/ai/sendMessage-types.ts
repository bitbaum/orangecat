import type { PendingAction } from '@/services/cat/action-types';
/**
 * Shared types for the AI assistant message-send pipeline (sendMessage.ts +
 * sendMessage-internals.ts). Kept in their own module so the entry point and the
 * internal helpers can both import them without a circular dependency.
 */

export type AIProvider = 'openrouter' | 'groq';

export interface AssistantRecord {
  id: string;
  title: string;
  system_prompt: string | null;
  welcome_message: string | null;
  pricing_model: string;
  price_per_message: number | null;
  price_per_1k_tokens: number | null;
  user_id: string;
  model_preference: string | null;
  allowed_models: string[] | null;
  min_model_tier: string | null;
  temperature: number | null;
  max_tokens_per_response: number | null;
  free_messages_per_day: number | null;
}

export interface SendMessageResult {
  userMessage: Record<string, unknown>;
  assistantMessage: Record<string, unknown>;
  /** What the companion proposed to set in motion, waiting for the person's tap (hands.ts). */
  pendingAction?: PendingAction;
  /** How many hands the bot ran on its own this turn; their lines are in the thread. */
  steps?: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    apiCostBtc: number;
    totalCostBtc: number;
  };
  userStatus: {
    hasByok: boolean;
    usedFreeMessage: boolean;
    freeMessagesRemaining: number;
    freeMessagesPerDay: number;
  };
}

export type SendMessageError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'ARCHIVED' }
  | { code: 'RATE_LIMITED'; message: string }
  | { code: 'SERVICE_UNAVAILABLE' }
  | {
      code: 'INSUFFICIENT_CREDITS';
      currentBalance: number;
      requiredAmount: number;
      shortfall: number;
    }
  | {
      code: 'AI_ERROR';
      message: string;
      /** The shared pool could not answer (not the person's own key): their
       *  own key is the way out, and the chat offers it. */
      sharedPool?: boolean;
    }
  | { code: 'DB_ERROR'; message: string };
