/**
 * The client a bot turn calls with the person's own key (own-key.ts picks the
 * key). Apart from the lookup on purpose: this file imports a model client,
 * and only a turn somebody sent may reach one.
 */
import { createOpenAICompatibleServiceWithByok } from '@/services/ai/openai-compat';

import { lokiKeyService } from './loki-key-service';
import { directRuntime, type OwnKey } from './own-key';
import type { AiService } from './types';

/** The client and model for a key that is not OpenRouter's, or null. */
export function directKeyService(own: OwnKey): { service: AiService; model: string } | null {
  if (own.lokiActorId) {
    // The key stays on Loki. No model named here means the one chosen there.
    return { service: lokiKeyService(own.lokiActorId, own.provider), model: own.model ?? '' };
  }
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
