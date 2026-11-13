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
import {
  getAvailableModels,
  getFreeModels,
  getModelMetadata,
  type AIModelMetadata,
} from '@/config/ai-models';
import { getCreditBalance } from '@/services/cat/credits';
import { MIN_FRONTIER_BALANCE_BTC } from '@/services/cat/credit-metering';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getAIProvider } from '@/data/aiProviders';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { isProbedProvider, modelsForKey, type KeyModels } from '@/services/cat/key-models';
import { isCallableThroughLoki } from '@/services/ai/own-key';
import { isModelId } from '@/services/ai/own-models';
import { listLokiModels, sharedLokiOwnKeys } from '@/services/loki/shared-keys';

/** Names a provider lists that are not for a conversation. */
const NOT_A_CHAT_MODEL =
  /embed|whisper|tts|audio|speech|transcri|image|moderation|rerank|guard|imagine/i;

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
   * True only when the user has a verified OpenRouter key — the one provider
   * whose single key routes arbitrary model ids. Gates the custom-model input:
   * no free-text entry of models you cannot reach.
   */
  allowsCustomModel: boolean;
  creditBalanceBtc: number;
  /**
   * Set when "Auto" does not mean the free pool: the person keeps a key on
   * Loki, switched on for OrangeCat, and the Cat answers on it. The picker
   * says so instead of "Best Free".
   */
  autoOn?: { provider: string; providerName: string; model: string | null; heldOn: 'loki' };
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
 * The models each of the user's verified DIRECT keys (Anthropic, OpenAI, Groq…)
 * can use, asked of the provider itself. OpenRouter is not asked — it already
 * unlocks the whole registry below.
 */
async function directKeyModels(supabase: AnySupabaseClient, userId: string): Promise<KeyModels[]> {
  const keys = await createApiKeyService(supabase).listDecryptedKeysOrdered(userId);
  const direct = keys.filter(k => isProbedProvider(k.provider));
  return Promise.all(direct.map(k => modelsForKey(k.provider, k.key)));
}

/** A model a direct key lists, in the picker's shape. Registry metadata when we have it. */
function toKeyModel(id: string, keyModels: KeyModels): UsableModel {
  const known = getModelMetadata(id);
  const providerName = getAIProvider(keyModels.provider)?.name ?? keyModels.provider;
  const strongest = id === keyModels.suggested ? ' · strongest' : '';
  return {
    id,
    name: known?.name ?? id,
    provider: `${providerName} · your key${strongest}`,
    tier: known?.tier ?? 'premium',
    contextWindow: known?.contextWindow ?? 0,
    capabilities: known?.capabilities ?? ['text', 'streaming'],
    source: 'byok',
  };
}

/** A key kept on Loki and switched on for OrangeCat, with the models it lists. */
export interface LokiKeyModels {
  provider: string;
  chosen: string | null;
  models: string[];
}

/**
 * A provider's model names for a menu: the one the person chose first, then
 * the rest by name, higher numbers on top. The names are the provider's own
 * (read through Loki, never a table kept here). This is an order by NAME,
 * not by age: "grok-4.20" sorts above "grok-4.7" although it is the older
 * model, and only the provider's creation dates could say so. Loki passes
 * names alone today. Pure.
 */
export function chosenFirst(ids: readonly string[], chosen: string | null): string[] {
  const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const sorted = [...ids].sort((a, b) => byName.compare(b, a));
  return chosen && sorted.includes(chosen)
    ? [chosen, ...sorted.filter(id => id !== chosen)]
    : sorted;
}

/** The first switched-on Loki key this app can call, and its models. Never throws. */
async function lokiKeyModels(
  supabase: AnySupabaseClient,
  userId: string
): Promise<LokiKeyModels | null> {
  const key = (await sharedLokiOwnKeys(supabase, userId)).find(
    k => k.lokiActorId && isCallableThroughLoki(k.provider)
  );
  if (!key?.lokiActorId) {
    return null;
  }
  const listed = await listLokiModels(key.lokiActorId, key.provider);
  return {
    provider: key.provider,
    chosen: listed.chosen ?? key.model ?? null,
    models: chosenFirst(
      listed.models.filter(id => isModelId(id) && !NOT_A_CHAT_MODEL.test(id)),
      listed.chosen ?? key.model ?? null
    ).slice(0, 80),
  };
}

export interface ModelAccessDeps {
  /** Test seam for the per-key provider lookup. */
  directKeyModels?: (supabase: AnySupabaseClient, userId: string) => Promise<KeyModels[]>;
  /** Test seam for the key the person keeps on Loki. */
  lokiKeyModels?: (supabase: AnySupabaseClient, userId: string) => Promise<LokiKeyModels | null>;
}

/**
 * Resolve the models this user can use right now, plus the ones locked behind a
 * key or credits. Pure read; never throws (a balance/key read failure degrades
 * to "free only", which is the honest floor).
 */
export async function getUsableModels(
  supabase: AnySupabaseClient,
  userId: string,
  deps: ModelAccessDeps = {}
): Promise<ModelAccess> {
  const [byokProviders, creditBalanceBtc, keyModels, onLoki] = await Promise.all([
    getVerifiedProviderIds(supabase, userId).catch(() => [] as string[]),
    getCreditBalance(supabase, userId).catch(() => 0),
    (deps.directKeyModels ?? directKeyModels)(supabase, userId).catch(() => [] as KeyModels[]),
    (deps.lokiKeyModels ?? lokiKeyModels)(supabase, userId).catch(() => null),
  ]);

  const hasAggregatorKey = byokProviders.includes(AGGREGATOR_PROVIDER);
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

  // The user's own direct keys: every model the provider lists for that key,
  // strongest first — the model someone pays for is one they can pick.
  const offered = new Set(models.map(m => m.id));
  for (const km of keyModels) {
    for (const id of km.models) {
      if (offered.has(id)) {
        continue;
      }
      offered.add(id);
      models.push(toKeyModel(id, km));
    }
  }

  // A key kept on Loki answers only when none is saved here (the resolver's
  // rule, loki-key-step.ts), so that is when its models are offered.
  const lokiKey = byokProviders.length === 0 ? onLoki : null;
  const lokiName = lokiKey ? (getAIProvider(lokiKey.provider)?.name ?? lokiKey.provider) : '';
  for (const id of lokiKey?.models ?? []) {
    if (offered.has(id)) {
      continue;
    }
    offered.add(id);
    const known = getModelMetadata(id);
    models.push({
      id,
      name: known?.name ?? id,
      provider: `${lokiName} · your key on Loki${id === lokiKey?.chosen ? ' · chosen there' : ''}`,
      tier: known?.tier ?? 'premium',
      contextWindow: known?.contextWindow ?? 0,
      capabilities: known?.capabilities ?? ['text', 'streaming'],
      source: 'byok',
    });
  }

  return {
    models,
    locked,
    byokProviders,
    allowsCustomModel: hasAggregatorKey,
    creditBalanceBtc,
    ...(lokiKey
      ? {
          autoOn: {
            provider: lokiKey.provider,
            providerName: lokiName,
            model: lokiKey.chosen,
            heldOn: 'loki' as const,
          },
        }
      : {}),
  };
}
