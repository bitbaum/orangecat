/**
 * The person's own key a bot turn runs on.
 *
 * A bot turn read one key only: an OpenRouter key marked primary. Settings →
 * AI takes keys for seven providers and says messages then route through the
 * key. A person who added a Groq, Anthropic, OpenAI, Together, DeepSeek or xAI
 * key still had every bot turn sent to the shared free pool, and so did one
 * whose OpenRouter key was no longer the primary. On 2026-11-12 the pool
 * could not answer for hours, and "add your own key" would have led most
 * people straight back to the same failure.
 *
 * The rule is the Cat's own (cat/provider-resolver): the person's valid keys
 * in the order they saved them, the first one this app can call.
 */
import { getProviderRuntime, PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { createOpenAICompatibleServiceWithByok } from '@/services/ai/openai-compat';
import { PLATFORM_GROQ_MODEL } from '@/services/ai/groq-models';

import type { AiService } from './types';

export interface OwnKey {
  provider: string;
  key: string;
}

/** Where a key of this provider is called and with which model, or null when
 *  this app has no client for it. OpenRouter is not here: it keeps its own
 *  routed client and model choice (sendMessage-internals). */
function directRuntime(provider: string): { baseUrl: string; model: string } | null {
  if (provider === 'groq') {
    return { baseUrl: PROVIDER_BASE_URLS.groq, model: PLATFORM_GROQ_MODEL };
  }
  const runtime = getProviderRuntime(provider);
  return runtime ? { baseUrl: runtime.baseUrl, model: runtime.defaultModel } : null;
}

/** Pure: the first of the person's keys, in their saved order, a bot can run on. */
export function pickOwnKey(keys: ReadonlyArray<OwnKey>): OwnKey | null {
  return (
    keys.find(
      k => !!k.key && (k.provider === 'openrouter' || directRuntime(k.provider) !== null)
    ) ?? null
  );
}

/** The client and model for a key that is not OpenRouter's. */
export function directKeyService(own: OwnKey): { service: AiService; model: string } | null {
  const runtime = directRuntime(own.provider);
  if (!runtime) {
    return null;
  }
  return {
    service: createOpenAICompatibleServiceWithByok({
      apiKey: own.key,
      baseUrl: runtime.baseUrl,
      providerId: own.provider,
    }),
    model: runtime.model,
  };
}
