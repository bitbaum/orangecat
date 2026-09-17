/**
 * Platform-tier provider chain — the ADAPTER, not the definition.
 *
 * This file used to answer two questions: which vendors and models make up the
 * chain, and how to turn one into a callable service. The first answer was ALSO
 * written in services/cat/provider-catalog.ts for the rot check, and the two
 * drifted — different order, and Together present here but watched nowhere.
 *
 * So the chain now has ONE definition (`servingChain()`), and this file does
 * only the second job: map each link ai-kit hands back onto a ready-to-call
 * `AiService`. A vendor added to the chain is dialled AND rot-checked without
 * touching this file.
 *
 * What stays here is what is genuinely OrangeCat's and has no place in a shared
 * chain: how each vendor's client is constructed, the local Ollama backstop
 * (no key, no catalogue, so not a chain vendor at all), and the circuit breaker
 * over recently-failed links.
 *
 * Created: 2026-06-10
 */

import { usableChain, type Link } from '@bitbaum/ai-kit';

import {
  createGroqService,
  createOpenRouterService,
  createOpenAICompatibleServiceWithByok,
} from '@/services/ai';
import { servingChain } from '@/services/cat/provider-catalog';
import { pruneDownLinks } from '@/services/ai/link-health';

import type { AiService } from './types';

export interface PlatformProvider {
  /**
   * Vendor id, as a STRING rather than a union of the vendors that existed when
   * this was written. The union here read
   * `'groq' | 'openrouter' | 'together' | 'ollama' | 'cerebras'` while the code
   * cast `vendor.id as PlatformProvider['providerId']` — so it still named
   * cerebras, which had been rejected, and omitted google, which was live. The
   * cast hid both. Vendors come from config; config is not knowable at compile
   * time.
   */
  providerId: string;
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

/**
 * Default model name for the Hetzner-hosted Ollama, overridable by env.
 * Llama 3.2 3B is the sweet spot for CPU-only Hetzner boxes (CCX23-class):
 * ~10-15 tok/sec quantized, fits in 4-8GB RAM, usable for chat.
 */
const PLATFORM_OLLAMA_DEFAULT_MODEL = 'llama3.2';

/**
 * The client for one vendor.
 *
 * Groq and OpenRouter have hand-written services because they carry
 * vendor-specific behaviour the generic client does not model — Groq's TPM
 * pre-flight and refusal-body parsing, OpenRouter's routed `:free` ids.
 * Everything else speaks plain OpenAI-compatible HTTP, so it gets the generic
 * client rather than a new file per vendor.
 */
function serviceFor(link: Link, key: string): AiService {
  if (link.provider.id === 'groq') {
    return createGroqService();
  }
  if (link.provider.id === 'openrouter') {
    return createOpenRouterService();
  }
  return createOpenAICompatibleServiceWithByok({
    apiKey: key,
    baseUrl: link.provider.baseUrl,
    providerId: link.provider.id,
  });
}

/**
 * Compose the platform chain for a single chat request.
 *
 * @param message  the user's message — the chain orders OpenRouter's free pool
 *                 by what fits this turn.
 */
export function buildPlatformProviders(message: string): PlatformProvider[] {
  // usableChain drops any vendor whose key is absent and expands the rest into
  // one link per model, in chain order — the loop this file used to write out
  // by hand, once per vendor.
  const out: PlatformProvider[] = usableChain(servingChain(message)).map(link => {
    const key = process.env[link.provider.keyEnv]?.trim() ?? '';
    return {
      providerId: link.provider.id,
      aiService: serviceFor(link, key),
      defaultModel: link.model,
      toolEndpoint: `${link.provider.baseUrl}/chat/completions`,
      toolKey: key,
    };
  });

  // Ollama last, and separately: it has no API key and no catalogue, so it is
  // neither gated by usableChain nor meaningful to rot-check. It is the
  // sovereignty backstop — a local process that answers when every vendor is
  // spent — which is exactly why it belongs after all of them.
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
