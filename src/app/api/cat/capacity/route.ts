/**
 * GET /api/cat/capacity — how much of the free AI pool is left, and for whom.
 *
 * Three numbers a person asked for and could not see anywhere (2026-09-11):
 * Groq's remaining requests per day and tokens per minute for the platform
 * key (from Groq's own rate-limit headers, as last observed), whether the
 * free OpenRouter pool has hit its daily cap (and when it resets), and the
 * user's own daily allowance. Also the prompt budget Cat is currently built
 * to, so "why was my context shortened" has an answer.
 *
 * No keys, no secrets — counts and timestamps only.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/standardResponse';
import { createApiKeyService } from '@/services/ai/api-key-service';
import {
  CONFIGURED_GROQ_MODEL_IDS,
  DEFAULT_GROQ_MODEL,
  GROQ_CHAT_MAX_TOKENS,
} from '@/services/ai/groq';
import {
  getGroqObservations,
  getGroqTpmLimit,
  getOpenRouterFreeStatus,
  type GroqRateLimitObservation,
} from '@/services/ai/groq-capacity';
import { secondsUntilUtcMidnight } from '@/services/cat/quota-helpers';

export interface CatCapacityResponse {
  groq: {
    configured: boolean;
    models: Array<{
      model: string;
      /** Tokens per minute this key may spend on one request, as learned. */
      tpmLimit: number;
      observation: GroqRateLimitObservation | null;
    }>;
  };
  openrouter: {
    configured: boolean;
    freeDailyCapHitAt: string | null;
    freeResetsAt: string | null;
  };
  quota: {
    dailyLimit: number;
    dailyRequests: number;
    requestsRemaining: number;
    resetInSeconds: number;
  };
  promptBudget: {
    model: string;
    tpmLimit: number;
    replyReserveTokens: number;
    budgetTokens: number;
  };
  asOf: string;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  const usage = await createApiKeyService(supabase).checkPlatformUsage(user.id);
  const byModel = new Map(getGroqObservations().map(o => [o.model, o]));
  const openrouter = getOpenRouterFreeStatus();
  const tpmLimit = getGroqTpmLimit(DEFAULT_GROQ_MODEL);
  const payload: CatCapacityResponse = {
    groq: {
      configured: Boolean(process.env.GROQ_API_KEY),
      models: CONFIGURED_GROQ_MODEL_IDS.map(model => ({
        model,
        tpmLimit: getGroqTpmLimit(model),
        observation: byModel.get(model) ?? null,
      })),
    },
    openrouter: {
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      freeDailyCapHitAt: openrouter.dailyCapHitAt,
      freeResetsAt: openrouter.resetsAt,
    },
    quota: {
      dailyLimit: usage.daily_limit,
      dailyRequests: usage.daily_requests,
      requestsRemaining: usage.requests_remaining,
      resetInSeconds: secondsUntilUtcMidnight(),
    },
    promptBudget: {
      model: DEFAULT_GROQ_MODEL,
      tpmLimit,
      replyReserveTokens: GROQ_CHAT_MAX_TOKENS,
      budgetTokens: tpmLimit - GROQ_CHAT_MAX_TOKENS - 150,
    },
    asOf: new Date().toISOString(),
  };
  return apiSuccess(payload, { cache: 'NONE' });
});
