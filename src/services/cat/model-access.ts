/**
 * Model access resolver — the SSOT for "what can THIS user actually use right now".
 *
 * The picker must never be a fake magic list. Availability is DERIVED from real
 * state: the platform free pool (always), the user's verified BYOK keys, and
 * their Cat Credits balance. Every model the picker shows is reachable; every
 * model it can't reach is surfaced as an honest "connect a key / add credits to
 * unlock" — never a fake-enabled row that silently substitutes a free model.
 *
 * This mirrors, for the UI, the same inputs `provider-resolver.ts` uses at
 * send-time — so what the picker offers and what the resolver serves agree.
 */
import { getAvailableModels, getFreeModels, type AIModelMetadata } from '@/config/ai-models';
import { getCreditBalance } from '@/services/cat/credits';
import { MIN_FRONTIER_BALANCE_BTC } from '@/services/cat/credit-metering';
import { DATABASE_TABLES } from '@/config/database-tables';
import { CUSTOM_PROVIDER_ID } from '@/data/aiProviders';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** How a model is served for this specific user. */
export type ModelAccessSource = 'free' | 'byok' | 'credits';

export interface UsableModel {
  id: string;
  name: string;
  /** Model author label (e.g. "Anthropic") — NOT the access path. */
  provider: string;
  tier: AIModelMetadata['tier'];
  contextWindow: number;
  capabilities: AIModelMetadata['capabilities'];
  source: ModelAccessSource;
  costPer1M?: { input: number; output: number };
}

export interface LockedModel {
  id: string;
  name: string;
  provider: string;
  tier: AIModelMetadata['tier'];
  /** What would unlock it — any one path is enough. */
  unlock: Array<'credits' | 'byok'>;
}

export interface ModelAccess {
  /** Models the user can select and actually receive right now. */
  models: UsableModel[];
  /** Real models that exist but the user can't reach yet — shown as CTAs, never enabled. */
  locked: LockedModel[];
  /** Verified BYOK provider ids the user holds (lowercased). */
  byokProviders: string[];
  /**
   * True when the user holds a verified OpenRouter key (one key routes
   * arbitrary model ids) or their own endpoint (whose models no registry can
   * name). Gates the custom-model input: no free-text entry of models you
   * cannot reach.
   */
  allowsCustomModel: boolean;
  creditBalanceBtc: number;
}

/** OpenRouter is the aggregator: one verified key → any registry/custom model id. */
const AGGREGATOR_PROVIDER = 'openrouter';

/**
 * Which verified providers does the user hold? Reads is_valid keys only — a
 * revoked key that hasn't been re-checked still counts here (that liveness gap
 * is closed separately by the validation-lifecycle work), but a blindly-stored
 * key never does: keys are validated against the provider before is_valid=true.
 */
async function getVerifiedProviderIds(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from(DATABASE_TABLES.USER_API_KEYS)
    .select('provider')
    .eq('user_id', userId)
    .eq('is_valid', true);
  const rows = (data ?? []) as Array<{ provider: string }>;
  return [...new Set(rows.map(r => r.provider.toLowerCase()))];
}

function toUsable(m: AIModelMetadata, source: ModelAccessSource): UsableModel {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    tier: m.tier,
    contextWindow: m.contextWindow,
    capabilities: m.capabilities,
    source,
    costPer1M:
      m.inputCostPer1M || m.outputCostPer1M
        ? { input: m.inputCostPer1M, output: m.outputCostPer1M }
        : undefined,
  };
}

/**
 * Resolve the models this user can use right now, plus the ones locked behind a
 * key or credits. Pure read; never throws (a balance/key read failure degrades
 * to "free only", which is the honest floor).
 */
export async function getUsableModels(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ModelAccess> {
  const [byokProviders, creditBalanceBtc] = await Promise.all([
    getVerifiedProviderIds(supabase, userId).catch(() => [] as string[]),
    getCreditBalance(supabase, userId).catch(() => 0),
  ]);

  const hasAggregatorKey = byokProviders.includes(AGGREGATOR_PROVIDER);
  const hasOwnEndpoint = byokProviders.includes(CUSTOM_PROVIDER_ID);
  const hasCredits = creditBalanceBtc >= MIN_FRONTIER_BALANCE_BTC;

  const models: UsableModel[] = [];
  const locked: LockedModel[] = [];

  // Free pool — always reachable.
  for (const m of getFreeModels()) {
    models.push(toUsable(m, 'free'));
  }

  // Paid registry models — reachable via a routing key (BYOK) or Cat Credits.
  const paid = getAvailableModels().filter(m => !m.isFree);
  for (const m of paid) {
    if (hasAggregatorKey) {
      models.push(toUsable(m, 'byok'));
    } else if (hasCredits) {
      models.push(toUsable(m, 'credits'));
    } else {
      locked.push({
        id: m.id,
        name: m.name,
        provider: m.provider,
        tier: m.tier,
        unlock: ['credits', 'byok'],
      });
    }
  }

  return {
    models,
    locked,
    byokProviders,
    allowsCustomModel: hasAggregatorKey || hasOwnEndpoint,
    creditBalanceBtc,
  };
}
