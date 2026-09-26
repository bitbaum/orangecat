/**
 * What a user's OWN direct key can reach — the models its provider lists for
 * that key, and the strongest of them.
 *
 * Before this, only an OpenRouter key unlocked anything in the picker: a
 * verified Anthropic, OpenAI or Groq key added no models at all, and on "auto"
 * the resolver sent it a hardcoded default (`gpt-4o-mini`, `grok-2-latest`)
 * instead of the best model the person was paying for.
 *
 * The provider is asked with ai-kit's `probeByokKey`, which ranks the key's
 * chat models without naming any, so there is no model list here to go stale.
 * Answers are cached per key for a few minutes: the picker opens often, and a
 * provider's catalogue does not change between two clicks.
 */
import { createHash } from 'node:crypto';
import { probeByokKey } from '@bitbaum/ai-kit/byok-probe';
import { BYOK_VENDOR_IDS } from '@bitbaum/ai-kit/byok';

export interface KeyModels {
  provider: string;
  /** Model ids this key can use, strongest first. Empty when the provider could not be read. */
  models: string[];
  /** The strongest chat model this key can use, or null when unknown. */
  suggested: string | null;
}

type Probe = typeof probeByokKey;

/**
 * OpenRouter is the aggregator — one key already unlocks the whole registry
 * and custom ids (model-access.ts), so it is not probed here.
 */
const AGGREGATOR = 'openrouter';

/** Per key, longest a picker shows a list without asking the provider again. */
const TTL_MS = 10 * 60_000;
/** A provider that does not answer in this long leaves the key at its default. */
const PROBE_TIMEOUT_MS = 4_000;
/** Enough to find the strongest few; a full catalogue buries them. */
export const MAX_MODELS_PER_KEY = 12;

const cache = new Map<string, { at: number; value: KeyModels }>();

/** Can this provider's key be asked for its models? */
export function isProbedProvider(provider: string): boolean {
  const id = provider.toLowerCase();
  return id !== AGGREGATOR && (BYOK_VENDOR_IDS as readonly string[]).includes(id);
}

function cacheKey(provider: string, key: string): string {
  // Never keep the key itself as a map key.
  return `${provider}:${createHash('sha256').update(key).digest('hex')}`;
}

/**
 * The models one stored key can use. Never throws: a provider that is down or
 * refuses the key yields no models, and the caller falls back as before.
 */
export async function modelsForKey(
  provider: string,
  key: string,
  opts: { probe?: Probe; now?: number } = {}
): Promise<KeyModels> {
  const id = provider.toLowerCase();
  const empty: KeyModels = { provider: id, models: [], suggested: null };
  if (!isProbedProvider(id)) {
    return empty;
  }

  const now = opts.now ?? Date.now();
  const slot = cacheKey(id, key);
  const hit = cache.get(slot);
  if (hit && now - hit.at < TTL_MS) {
    return hit.value;
  }

  try {
    const result = await (opts.probe ?? probeByokKey)(id, key, { timeoutMs: PROBE_TIMEOUT_MS });
    const value: KeyModels = result.ok
      ? {
          provider: id,
          models: result.models.slice(0, MAX_MODELS_PER_KEY),
          suggested: result.suggested,
        }
      : empty;
    // Only a real answer is cached; a failed read is retried on the next open.
    if (result.ok) {
      cache.set(slot, { at: now, value });
    }
    return value;
  } catch {
    return empty;
  }
}

/**
 * The cached answer for this key, without asking the provider — for the chat
 * path, which must not wait on a catalogue. A miss starts a refresh in the
 * background (a models listing: no tokens spent) so the next turn has it.
 */
export function peekModelsForKey(
  provider: string,
  key: string,
  now = Date.now()
): KeyModels | null {
  const id = provider.toLowerCase();
  if (!isProbedProvider(id)) {
    return null;
  }
  const hit = cache.get(cacheKey(id, key));
  if (hit && now - hit.at < TTL_MS) {
    return hit.value;
  }
  void modelsForKey(id, key);
  return null;
}

const isExplicit = (m?: string): m is string => Boolean(m) && m !== 'auto' && m !== 'any';

/**
 * Which model to send a direct key.
 *
 * - "auto": the strongest model this key can use, when known — not the
 *   provider's hardcoded default.
 * - A model the key lists: exactly that, even where the old per-provider rule
 *   would have swapped it (Groq only kept llama/mixtral/gemma ids, so picking
 *   `openai/gpt-oss-120b` on a Groq key silently sent the default).
 * - Anything else: the provider's own rule, as before (`otherwise`).
 */
export function modelForDirectKey(
  requestedModel: string | undefined,
  keyModels: KeyModels | null,
  otherwise: (requested: string | undefined) => string
): string {
  if (!isExplicit(requestedModel)) {
    return keyModels?.suggested ?? otherwise(requestedModel);
  }
  if (keyModels?.models.includes(requestedModel)) {
    return requestedModel;
  }
  return otherwise(requestedModel);
}

/** Test seam: forget every cached answer. */
export function clearKeyModelsCache(): void {
  cache.clear();
}
