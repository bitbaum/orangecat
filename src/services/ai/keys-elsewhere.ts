/**
 * Provider keys a person holds on Loki and not here.
 *
 * One person, two linked accounts, one key: on 2026-11-11 the owner's xAI key
 * was on Loki, where the chat answered on Grok, while the Cat here ran for the
 * same person on an exhausted free pool. Neither product could say so. Loki
 * now reports the NAMES of the keys it holds (services/loki/actor-status);
 * this turns them into a suggestion.
 *
 * No key crosses: Loki sends a vendor id and the last characters, and the
 * person pastes the key here themselves. Copying it across would mean one
 * service handing a user's secret to another on a shared signing secret, which
 * is a decision for the owner, not a default.
 */
import { getAIProvider, WIRED_PROVIDER_IDS } from '@/data/aiProviders';
import type { LokiModelKey } from '@/services/loki/actor-status';

export interface KeyElsewhere {
  /** Our provider id: what the add-key form takes. */
  provider: string;
  /** The provider's name as this app writes it. */
  name: string;
  /** "…abcd", so the person can tell which of their keys it is. */
  keyHint: string | null;
  /** Where the provider shows the key, when we know. */
  apiKeyUrl: string | null;
}

/**
 * Keys held on Loki for providers the Cat can run on and that the person has
 * not added here. A vendor we cannot route is left out: suggesting a key the
 * Cat could not use would be a dead end.
 */
export function keysOnLokiNotHere(
  onLoki: readonly LokiModelKey[],
  providersHere: readonly string[]
): KeyElsewhere[] {
  const here = new Set(providersHere);
  const wired = new Set<string>(WIRED_PROVIDER_IDS);
  const out: KeyElsewhere[] = [];
  for (const key of onLoki) {
    const provider = getAIProvider(key.vendor);
    if (!provider || !wired.has(provider.id) || here.has(provider.id)) {
      continue;
    }
    if (out.some(k => k.provider === provider.id)) {
      continue;
    }
    out.push({
      provider: provider.id,
      name: provider.name,
      keyHint: key.keyHint,
      apiKeyUrl: provider.apiKeyUrl ?? null,
    });
  }
  return out;
}
