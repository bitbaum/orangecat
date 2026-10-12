/**
 * The person's Cat quota right now — tier, today's counter, reset.
 *
 * Lifted out of GET /api/cat/quota so GET /api/cat/usage reads the exact same
 * numbers: the meter and the sentences under it come from one read, and a
 * second copy of the tier logic would be a second chance for them to disagree.
 *
 * Sources of truth:
 *   - tier: presence of a stored BYOK row on user_api_keys, else the paid plan
 *   - quota: ApiKeyService.checkPlatformUsage() — the same RPC the chat route
 *     uses at request time, so the meter never disagrees with the gate
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { resolveTier, secondsUntilUtcMidnight, type CatTier } from '@/services/cat/quota-helpers';
import { getUserPlan } from '@/services/billing/getUserPlan';
import { OPENAI_COMPAT_PROVIDER_IDS } from '@/config/ai-provider-runtime';
import { getAIProvider } from '@/data/aiProviders';

export interface CatQuota {
  tier: CatTier;
  hasGroqByok: boolean;
  hasOpenRouterByok: boolean;
  /**
   * Provider id Cat would route through right now if the user is on BYOK
   * (first match in priority order: groq > openrouter > openai > together
   * > deepseek > xai). Null when no BYOK key is stored. The UI displays
   * the name so the freedom architecture is visible in every chat.
   */
  activeByokProvider: string | null;
  /** Human-readable name of the active BYOK provider, if any. */
  activeByokProviderName: string | null;
  dailyLimit: number;
  dailyRequests: number;
  requestsRemaining: number;
  canUsePlatform: boolean;
  /** Seconds until the daily counter resets (UTC midnight). */
  resetInSeconds: number;
  /** ISO timestamp of Pro renewal deadline; null on Free/BYOK. */
  expiresAt: string | null;
}

const BYOK_PRIORITY: string[] = ['groq', 'openrouter', ...OPENAI_COMPAT_PROVIDER_IDS];

export async function readCatQuota(supabase: AnySupabaseClient, userId: string): Promise<CatQuota> {
  const keyService = createApiKeyService(supabase);

  const [keyChecks, usage, plan] = await Promise.all([
    Promise.all(BYOK_PRIORITY.map(p => keyService.hasValidKey(userId, p))),
    keyService.checkPlatformUsage(userId),
    getUserPlan(supabase, userId),
  ]);

  const hasGroqByok = keyChecks[BYOK_PRIORITY.indexOf('groq')] ?? false;
  const hasOpenRouterByok = keyChecks[BYOK_PRIORITY.indexOf('openrouter')] ?? false;

  const activeIndex = keyChecks.findIndex(Boolean);
  const activeByokProvider = activeIndex >= 0 ? (BYOK_PRIORITY[activeIndex] ?? null) : null;
  const activeByokProviderName = activeByokProvider
    ? (getAIProvider(activeByokProvider)?.name ?? activeByokProvider)
    : null;

  return {
    tier: resolveTier({ hasGroqByok, hasOpenRouterByok, paidTier: plan.tier }),
    hasGroqByok,
    hasOpenRouterByok,
    activeByokProvider,
    activeByokProviderName,
    dailyLimit: usage.daily_limit,
    dailyRequests: usage.daily_requests,
    requestsRemaining: usage.requests_remaining,
    canUsePlatform: usage.can_use_platform,
    resetInSeconds: secondsUntilUtcMidnight(),
    expiresAt: plan.expiresAt,
  };
}
