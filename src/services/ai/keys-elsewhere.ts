/**
 * Provider keys a person holds on Loki and not here.
 *
 * One person, two linked accounts, one key: on 2026-11-11 the owner's xAI key
 * was on Loki, where the chat answered on Grok, while the bots here ran for
 * the same person on an exhausted free pool. Neither product could say so.
 *
 * The key is never copied. Loki reports its NAME and last characters, and the
 * person, signed in here, may switch it on for their bots: a bot turn is then
 * answered by Loki, with the key, for the linked account
 * (services/loki/shared-keys.ts). Where Loki cannot do that yet, the older
 * suggestion stands: paste the same key here.
 */
import { getAIProvider, WIRED_PROVIDER_IDS } from '@/data/aiProviders';
import type { LokiModelKey } from '@/services/loki/actor-status';
import type { LokiHeldKey } from '@/services/loki/shared-keys';

export interface KeyElsewhere {
  /** Our provider id: what the add-key form takes, and what the switch names. */
  provider: string;
  /** The provider's name as this app writes it. */
  name: string;
  /** "…abcd", so the person can tell which of their keys it is. */
  keyHint: string | null;
  /** Where the provider shows the key, when we know. */
  apiKeyUrl: string | null;
  /** Loki can answer this person's bots on it: the switch is offered. */
  canShare: boolean;
  /** Switched on: the person's bots here answer on it now. */
  shared: boolean;
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
      canShare: false,
      shared: false,
    });
  }
  return out;
}

/**
 * Keys Loki can answer on for this person. Loki makes the call, so the
 * provider need not be one this app calls itself. A provider with a key saved
 * here is left out: that key already answers.
 */
export function keysLokiCanAnswerOn(
  onLoki: readonly LokiHeldKey[],
  providersHere: readonly string[]
): KeyElsewhere[] {
  const here = new Set(providersHere);
  const out: KeyElsewhere[] = [];
  for (const key of onLoki) {
    if (here.has(key.vendor) || out.some(k => k.provider === key.vendor)) {
      continue;
    }
    const provider = getAIProvider(key.vendor);
    out.push({
      provider: key.vendor,
      name: provider?.name ?? key.label,
      keyHint: key.keyHint,
      apiKeyUrl: provider?.apiKeyUrl ?? null,
      canShare: true,
      shared: key.shared,
    });
  }
  return out;
}
