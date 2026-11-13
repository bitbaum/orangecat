/**
 * The Cat answering on a key the person keeps on Loki.
 *
 * The person's bots already answer on such a key once it is switched on for
 * OrangeCat (services/ai/own-key.ts). The Cat is the same person's assistant
 * and reads the same switch: live on 2026-11-13 the owner had switched his
 * xAI key on, his Cat still said "Auto (Best Free)", and when the free pool
 * was spent it could not answer at all.
 *
 * The key never comes here: Loki makes the call for the linked account
 * (services/ai/loki-key-service.ts). The Cat's tool loop goes the same way:
 * the link names Loki's door and a marker for whose key, and
 * tool-transport.ts asks the door to make each step. So the tools run on
 * the model that answers, not on whatever link happens to hold a key here.
 */

import { getModelMetadata } from '@/config/ai-models';
import { getProviderRuntime } from '@/config/ai-provider-runtime';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { lokiKeyService } from '@/services/ai/loki-key-service';
import { isCallableThroughLoki, type OwnKey } from '@/services/ai/own-key';
import type { AiService } from '@/services/ai/types';
import { lokiToolKey } from '@/services/cat/tool-transport';
import { lokiModelUrl, sharedLokiOwnKeys } from '@/services/loki/shared-keys';

/** Ahead of the free pool wherever the person placed it. */
const LEADS = -0.5;
/** Behind everything: the key backs up a free model the person picked by name. */
const BACKS_UP = Number.MAX_SAFE_INTEGER - 100;

export interface LokiKeyStep {
  /** Where the link sits in the Cat's chain; lower is earlier. */
  order: number;
  link: {
    provider: string;
    modelToUse: string;
    aiService: AiService;
    hasByok: true;
    /** Loki's model door, and the marker that says whose key (tool-transport.ts). */
    toolEndpoint: string;
    toolKey: string;
  };
}

const named = (model: string | undefined): model is string =>
  Boolean(model) && model !== 'auto' && model !== 'any';

/**
 * The model a turn on this key runs on: one named from the key's own list as
 * named; otherwise the one chosen in Loki, else the provider's usual one. A
 * model from our free registry is never sent to the person's key. Pure.
 */
export function modelOnLokiKey(key: OwnKey, requestedModel: string | undefined): string {
  if (named(requestedModel) && !getModelMetadata(requestedModel)) {
    return requestedModel;
  }
  return key.model ?? getProviderRuntime(key.provider)?.defaultModel ?? '';
}

/** Where the key sits: first, unless the person picked a free model by name. Pure. */
export function lokiKeyOrder(requestedModel: string | undefined, index: number): number {
  const pickedFree = named(requestedModel) && Boolean(getModelMetadata(requestedModel)?.isFree);
  return (pickedFree ? BACKS_UP : LEADS) + index / 100;
}

/** The chain links for the person's switched-on Loki keys; none when Loki is not linked or silent. */
export async function lokiKeySteps(
  supabase: AnySupabaseClient,
  userId: string,
  requestedModel: string | undefined,
  read: typeof sharedLokiOwnKeys = sharedLokiOwnKeys
): Promise<LokiKeyStep[]> {
  const keys = await read(supabase, userId).catch(() => [] as OwnKey[]);
  return keys
    .filter(k => k.lokiActorId && isCallableThroughLoki(k.provider))
    .map((k, i) => ({
      order: lokiKeyOrder(requestedModel, i),
      link: {
        provider: k.provider,
        modelToUse: modelOnLokiKey(k, requestedModel),
        aiService: lokiKeyService(k.lokiActorId as string, k.provider),
        hasByok: true as const,
        toolEndpoint: lokiModelUrl(),
        toolKey: lokiToolKey(k.lokiActorId as string, k.provider),
      },
    }));
}
