/**
 * Platform-tier provider chain.
 *
 * Builds the ordered list of providers that can serve a Cat chat request
 * when the user hasn't BYOK'd. Each entry is a ready-to-call AI service —
 * the resolver and the chat route don't need to know which env vars are
 * set; they just take the chain and walk it.
 *
 * Priority (first available wins, the rest become the fallback chain):
 *   1. Groq           — fastest inference, generous free tier
 *   2. OpenRouter     — broadest catalog via the free model pool
 *   3. Together AI    — backup free pool, OpenAI-compatible
 *   4. Platform Ollama — Hetzner-hosted small model, sovereignty backstop
 *
 * Each provider is enabled by the presence of its env var. The chain
 * gracefully shrinks if some aren't configured — Cat works as long as
 * any one of them is alive. That's the "Cat survives anything" story.
 *
 * Created: 2026-06-10
 */

import {
  isGroqAvailable,
  createGroqService,
  createOpenRouterService,
  createOpenAICompatibleServiceWithByok,
  PLATFORM_GROQ_MODEL,
} from '@/services/ai';
import { getFreeModels, getModelMetadata, DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { createAutoRouter } from '@/services/ai/auto-router';
import { pruneDownLinks } from '@/services/ai/link-health';

import type { AiService } from './types';

export interface PlatformProvider {
  providerId: 'groq' | 'openrouter' | 'together' | 'ollama';
  /**
   * Where a raw tool-loop call should go for this provider, and with what.
   *
   * Published HERE because this is the function that already knows: it picks
   * the base url and the key to build `aiService`. A caller re-deriving the
   * pairing would be a second copy of it, and the first thing such a copy does
   * is miss a provider — send a Together model id to OpenRouter, or a LOCAL
   * Ollama model to a paid vendor, each with the wrong key.
   */
  toolEndpoint: string;
  toolKey: string;
  aiService: AiService;
  /** Model to use when the user hasn't requested a specific one. */
  defaultModel: string;
}

const TOGETHER_DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free';

/**
 * Default model name for the Hetzner-hosted Ollama, overridable by env.
 * Llama 3.2 3B is the sweet spot for CPU-only Hetzner boxes (CCX23-class):
 * ~10-15 tok/sec quantized, fits in 4-8GB RAM, usable for chat.
 */
const PLATFORM_OLLAMA_DEFAULT_MODEL = 'llama3.2';

/**
 * Compose the platform chain for a single chat request.
 *
 * @param message  the user's message — needed so the OpenRouter free-pool
 *                 auto-router can pick a model whose context fits.
 */
export function buildPlatformProviders(message: string): PlatformProvider[] {
  const out: PlatformProvider[] = [];

  if (isGroqAvailable()) {
    out.push({
      providerId: 'groq',
      aiService: createGroqService(),
      // The FREE model, not the capable one: a metered default here is a step
      // that can only 402, and this chain exists for users without a key.
      defaultModel: PLATFORM_GROQ_MODEL,
      toolEndpoint: `${PROVIDER_BASE_URLS.groq}/chat/completions`,
      toolKey: process.env.GROQ_API_KEY ?? '',
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    // OpenRouter exposes ~6 free models from different upstream providers
    // (Venice, Lambda, Chutes, etc.). Each has its own rate limit. When one
    // is congested (happens routinely on the popular Llama 3.3 70B), we want
    // to roll to the next one rather than declare defeat. Contribute one
    // entry per free model — the chat route walks them as separate fallbacks.
    const openrouterService = createOpenRouterService();
    for (const modelId of orderedOpenRouterFreeModels(message)) {
      out.push({
        providerId: 'openrouter',
        aiService: openrouterService,
        defaultModel: modelId,
        toolEndpoint: `${PROVIDER_BASE_URLS.openrouter}/chat/completions`,
        toolKey: process.env.OPENROUTER_API_KEY ?? '',
      });
    }
  }

  const togetherKey = process.env.TOGETHER_API_KEY;
  if (togetherKey) {
    out.push({
      providerId: 'together',
      aiService: createOpenAICompatibleServiceWithByok({
        apiKey: togetherKey,
        baseUrl: PROVIDER_BASE_URLS.together,
        providerId: 'together',
      }),
      defaultModel: process.env.TOGETHER_DEFAULT_MODEL || TOGETHER_DEFAULT_MODEL,
      toolEndpoint: `${PROVIDER_BASE_URLS.together}/chat/completions`,
      toolKey: togetherKey,
    });
  }

  const ollamaUrl = process.env.PLATFORM_OLLAMA_URL;
  if (ollamaUrl) {
    out.push({
      providerId: 'ollama',
      aiService: createOpenAICompatibleServiceWithByok({
        // Ollama by default requires no auth, but some deployments front it
        // with a reverse proxy that adds bearer auth. Allow either.
        apiKey: process.env.PLATFORM_OLLAMA_API_KEY || 'ollama-no-auth-required',
        baseUrl: ollamaUrl,
        providerId: 'ollama',
      }),
      defaultModel: process.env.PLATFORM_OLLAMA_MODEL || PLATFORM_OLLAMA_DEFAULT_MODEL,
      toolEndpoint: `${ollamaUrl}/chat/completions`,
      toolKey: process.env.PLATFORM_OLLAMA_API_KEY || 'ollama-no-auth-required',
    });
  }

  // Skip links that failed in the last minute (circuit breaker) — but never
  // prune to an empty chain; retrying dead links beats refusing to try.
  return pruneDownLinks(out, p => ({ provider: p.providerId, model: p.defaultModel }));
}

/**
 * Returns every OpenRouter free model the runtime knows about, ordered by
 * the auto-router's preference for THIS message (best fit first, others as
 * fallbacks). The first entry is what the auto-router would have picked
 * standalone; the rest let the chat route roll through the pool when an
 * upstream provider (Venice, Lambda, Chutes, ...) is congested.
 */
function orderedOpenRouterFreeModels(message: string): string[] {
  const freeIds = getFreeModels()
    .map(m => m.id)
    .filter(id => !!getModelMetadata(id));
  if (freeIds.length === 0) {
    return [DEFAULT_FREE_MODEL_ID];
  }

  const auto = createAutoRouter();
  const top = auto.selectModel({
    message,
    conversationHistory: [],
    allowedModels: freeIds,
  }).model;

  const head = getModelMetadata(top) ? top : freeIds[0];
  const rest = freeIds.filter(id => id !== head);
  return [head, ...rest];
}
