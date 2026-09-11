/**
 * Cat Provider Resolver
 *
 * Determines which AI provider (Groq / OpenRouter) and model to use,
 * resolves BYOK keys, enforces platform usage limits, and returns a
 * ready-to-use AI service pair with all metadata the route needs.
 */

import { createApiKeyService } from '@/services/ai/api-key-service';
import {
  createOpenRouterService,
  createGroqService,
  createOpenRouterServiceWithByok,
  createGroqServiceWithByok,
  createOpenAICompatibleServiceWithByok,
  isGroqAvailable,
  DEFAULT_GROQ_MODEL,
} from '@/services/ai';
import { getAdminClient } from '@/lib/supabase/admin';
import { isPlatformMeteredModel, checkFrontierAccess } from '@/services/cat/credit-metering';
import { getModelMetadata, DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import { getProviderRuntime, isOpenAICompatibleProvider } from '@/config/ai-provider-runtime';
import { createAutoRouter } from '@/services/ai/auto-router';
import { buildPlatformProviders } from '@/services/ai/platform-providers';
import { GROQ_KEY_HEADER, OPENROUTER_KEY_HEADER } from '@/config/http-headers';
import { ROUTES } from '@/config/routes';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { WiredProviderId } from '@/data/aiProviders';

// The routable-provider union IS the wired list — hand-typing it twice let
// the two drift.
export type AIProvider = WiredProviderId;

import type { AiService } from '@/services/ai/types';

/**
 * Pre-resolved alternate provider to use if the primary one rate-limits.
 * The chat route walks `fallbacks[]` in order, giving each provider one
 * shot before surfacing the error. As long as one alternate is healthy,
 * Cat keeps chatting.
 */
export interface FallbackProvider {
  provider: AIProvider;
  modelToUse: string;
  aiService: AiService;
  reason: 'rate_limit';
  /** Platform-served link (false = the user's own key). Drives circuit-breaker marking. */
  hasByok: boolean;
}

interface ResolvedProvider {
  provider: AIProvider;
  hasByok: boolean;
  modelToUse: string;
  aiService: AiService;
  platformUsage: { daily_limit: number; requests_remaining: number } | null;
  keyService: ReturnType<typeof createApiKeyService>;
  userGroqKey: string | null;
  /**
   * True when this request is a platform-served PAID model billed against the
   * user's Cat Credits (frontier access). Metered requests bypass the free
   * daily quota and must be debited after completion via meterCreditUsage.
   */
  metered: boolean;
  /**
   * Ordered chain of fallback providers to try on rate-limit. Built from
   * the platform chain (Groq + OpenRouter + Together + Ollama, whichever
   * are env-configured), with the primary provider removed. May be empty
   * — then a rate-limit just fails through to the honest error message.
   */
  fallbacks: FallbackProvider[];
}

/**
 * Resolves provider, keys, model, and platform limits for a Cat chat request.
 * Returns `ResolvedProvider` on success, or a `Response` to return directly on failure.
 */
export async function resolveProvider(
  supabase: AnySupabaseClient,
  userId: string,
  requestHeaders: Headers,
  opts: { requestedModel?: string; message: string }
): Promise<ResolvedProvider | Response> {
  const { requestedModel, message } = opts;
  const keyService = createApiKeyService(supabase);
  const evalLockProvider = requestHeaders.get('x-cat-eval-provider');
  const evalLock =
    requestHeaders.get('x-cat-eval-lock-model') === '1' &&
    Boolean(requestedModel) &&
    requestedModel !== 'auto' &&
    requestedModel !== 'any' &&
    (evalLockProvider === 'groq' || evalLockProvider === 'openrouter');

  // Per-request header keys are a one-off override (never persisted) and
  // always lead the chain. Stored keys come from the ordered chain below.
  const clientOpenRouterKey = requestHeaders.get(OPENROUTER_KEY_HEADER);
  const clientGroqKey = requestHeaders.get(GROQ_KEY_HEADER);

  // ── Build one merged, fully-ordered fallback chain ─────────────────────
  // The user can place the free OrangeCat platform default anywhere in the
  // chain (including first = primary), interleaved with their own keys. The
  // first entry is the primary; the rest are fallbacks tried in order on
  // rate-limit/error. For a user with no keys the chain is just [platform],
  // identical to the original behaviour.
  type ChainStep = {
    provider: AIProvider;
    modelToUse: string;
    aiService: AiService;
    hasByok: boolean;
  };

  const groqModelFor = (m?: string): string =>
    m?.startsWith('llama') || m?.startsWith('mixtral') || m?.startsWith('gemma')
      ? m
      : DEFAULT_GROQ_MODEL;

  // A concrete step for one BYOK key. Returns null for unknown/unconfigured
  // providers, which are then skipped from the chain.
  const buildKeyStep = (prov: string, key: string): ChainStep | null => {
    if (prov === 'groq') {
      return {
        provider: 'groq',
        modelToUse: groqModelFor(requestedModel),
        aiService: createGroqServiceWithByok(key),
        hasByok: true,
      };
    }
    if (prov === 'openrouter') {
      const explicit = requestedModel && requestedModel !== 'auto' && requestedModel !== 'any';
      let model: string;
      if (explicit) {
        // BYOK: the user pays for their own OpenRouter key, so trust whatever
        // model id they chose — including any of OpenRouter's 200+ models that
        // aren't in our curated registry. (Platform/non-BYOK usage goes through
        // buildPlatformProviders, which stays registry-constrained.)
        model = requestedModel;
      } else {
        model = createAutoRouter().selectModel({ message, conversationHistory: [] }).model;
        if (!getModelMetadata(model)) {
          model = DEFAULT_FREE_MODEL_ID;
        }
      }
      return {
        provider: 'openrouter',
        modelToUse: model,
        aiService: createOpenRouterServiceWithByok(key),
        hasByok: true,
      };
    }
    if (isOpenAICompatibleProvider(prov)) {
      const rt = getProviderRuntime(prov);
      if (!rt) {
        return null;
      }
      const model =
        requestedModel && requestedModel !== 'auto' && requestedModel !== 'any'
          ? requestedModel
          : (rt.defaultModel ?? DEFAULT_FREE_MODEL_ID);
      return {
        provider: prov as AIProvider,
        modelToUse: model,
        aiService: createOpenAICompatibleServiceWithByok({
          apiKey: key,
          baseUrl: rt.baseUrl,
          providerId: prov,
        }),
        hasByok: true,
      };
    }
    return null;
  };

  // Ordered entries — each expands to zero or more steps. Lower order =
  // earlier in the chain.
  type Entry = { order: number; build: () => ChainStep[] };
  const entries: Entry[] = [];
  const seenKeys = new Set<string>();

  if (evalLock) {
    entries.push({
      order: -10,
      build: () => {
        if (evalLockProvider === 'groq' && isGroqAvailable()) {
          return [
            {
              provider: 'groq',
              modelToUse: requestedModel!,
              aiService: createGroqService(),
              hasByok: false,
            },
          ];
        }
        if (evalLockProvider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
          return [
            {
              provider: 'openrouter',
              modelToUse: requestedModel!,
              aiService: createOpenRouterService(),
              hasByok: false,
            },
          ];
        }
        return [];
      },
    });
  } else if (clientGroqKey) {
    seenKeys.add(clientGroqKey);
    entries.push({
      order: -2,
      build: () => {
        const s = buildKeyStep('groq', clientGroqKey);
        return s ? [s] : [];
      },
    });
  }
  if (!evalLock && clientOpenRouterKey) {
    seenKeys.add(clientOpenRouterKey);
    entries.push({
      order: -1,
      build: () => {
        const s = buildKeyStep('openrouter', clientOpenRouterKey);
        return s ? [s] : [];
      },
    });
  }

  // Stored user keys in their saved order.
  const storedKeys = evalLock ? [] : await keyService.listDecryptedKeysOrdered(userId);
  if (!evalLock) {
    for (const k of storedKeys) {
      if (seenKeys.has(k.key)) {
        continue; // a header already supplied this exact key
      }
      seenKeys.add(k.key);
      entries.push({
        order: k.sortOrder,
        build: () => {
          const s = buildKeyStep(k.provider, k.key);
          return s ? [s] : [];
        },
      });
    }
  }

  // The free platform default at its saved position (only if env-configured).
  const platformConfigured = isGroqAvailable() || !!process.env.OPENROUTER_API_KEY;
  if (!evalLock && platformConfigured) {
    const platformPos = await keyService.getPlatformChainPosition(userId);
    entries.push({
      order: platformPos,
      build: () =>
        buildPlatformProviders(message).map(p => ({
          provider: p.providerId as AIProvider,
          modelToUse: p.defaultModel,
          aiService: p.aiService,
          hasByok: false,
        })),
    });
  }

  // Sort by position, then expand into the concrete chain.
  entries.sort((a, b) => a.order - b.order);
  const chain: ChainStep[] = entries.flatMap(e => e.build());

  if (chain.length === 0) {
    return Response.json(
      {
        success: false,
        error: 'AI chat not configured',
        code: 'NO_API_KEY',
        message:
          'To use My Cat AI chat, you need to add your own API key in Settings → AI. Get a free Groq key at console.groq.com/keys',
        hasByok: false,
        helpUrl: ROUTES.SETTINGS_AI,
      },
      { status: 503 }
    );
  }

  let primary = chain[0];

  // ── Frontier access (Cat Credits) ───────────────────────────────────────
  // A PAID registry model requested by a user whose chain would serve it from
  // the platform is metered against Cat Credits: gate on balance up front,
  // serve via the platform OpenRouter key, debit after completion. BYOK
  // primaries are untouched — the user's own key, their own bill.
  let metered = false;
  if (
    !primary.hasByok &&
    isPlatformMeteredModel(requestedModel) &&
    process.env.OPENROUTER_API_KEY
  ) {
    const access = await checkFrontierAccess(getAdminClient() as AnySupabaseClient, userId);
    if (!access.allowed) {
      return Response.json(
        {
          success: false,
          error: 'Not enough Cat Credits for this model',
          code: 'INSUFFICIENT_CREDITS',
          message:
            'This is a paid frontier model. Top up Cat Credits in Settings → AI, or pick a free model.',
          balanceBtc: access.balanceBtc,
          helpUrl: ROUTES.SETTINGS_AI,
        },
        { status: 402 }
      );
    }
    primary = {
      provider: 'openrouter',
      modelToUse: requestedModel!,
      aiService: createOpenRouterService(),
      hasByok: false,
    };
    metered = true;
  }

  const provider = primary.provider;
  const hasByok = primary.hasByok;
  const modelToUse = primary.modelToUse;
  const aiService = primary.aiService;

  // Platform usage limit applies only when the platform default is the
  // primary (it will actually serve and increment usage). This matches the
  // chat route, which increments platform usage on `!hasByok`, and keeps the
  // no-keys path identical to before. Metered (credit-paid) requests are
  // exempt — they are paid, not free-quota, usage.
  let platformUsage: { daily_limit: number; requests_remaining: number } | null = null;
  if (!hasByok && !metered) {
    const usage = await keyService.checkPlatformUsage(userId);
    if (!usage.can_use_platform) {
      return Response.json(
        {
          success: false,
          error: 'Daily limit reached',
          code: 'DAILY_LIMIT',
          message:
            "You've used today's free Cat messages. Top up Cat Credits or add your own key — both remove the daily cap.",
          retryAfter: 86400,
          helpUrl: ROUTES.SETTINGS_AI,
        },
        { status: 429 }
      );
    }
    platformUsage = {
      daily_limit: usage.daily_limit,
      requests_remaining: usage.requests_remaining,
    };
  }

  // Surfaced for the chat route's Groq tool-calling enrichment — the primary
  // Groq BYOK key if that's what's leading the chain, else null (platform
  // Groq carries its own env key inside the service).
  const userGroqKey =
    provider === 'groq' && hasByok
      ? (clientGroqKey ?? storedKeys.find(k => k.provider === 'groq')?.key ?? null)
      : null;

  // Everything after the primary becomes the fallback chain, tried in order
  // on rate-limit/error. The Cat keeps chatting as long as one link is alive.
  // A metered frontier primary sits ABOVE the regular chain, so the whole
  // chain backs it up (falling back to a free model is safe — the debit only
  // fires for completions actually served by the metered model).
  const fallbackSteps = evalLock ? [] : metered ? chain : chain.slice(1);
  const fallbacks: FallbackProvider[] = fallbackSteps.map(s => ({
    provider: s.provider,
    modelToUse: s.modelToUse,
    aiService: s.aiService,
    reason: 'rate_limit' as const,
    hasByok: s.hasByok,
  }));

  return {
    provider,
    hasByok,
    modelToUse,
    aiService,
    platformUsage,
    keyService,
    userGroqKey,
    metered,
    fallbacks,
  };
}
