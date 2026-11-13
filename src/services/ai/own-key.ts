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
 * in the order they saved them, the first one this app can call. When none is
 * saved here, a key the person keeps on Loki and switched on for their bots
 * counts as theirs too; it is called through Loki and never copied.
 *
 * This file only LOOKS a key up. It imports no model client, because a page
 * load reads it (the routine's settings row asks whether the bot can run),
 * and no GET may be able to reach a model (__tests__/unit/ci/no-background-ai).
 * The client for a key is built in own-key-service.ts, by the turn alone.
 */
import { getProviderRuntime, PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { PLATFORM_GROQ_MODEL } from '@/services/ai/groq-models';

export interface OwnKey {
  provider: string;
  /** Empty for a key that stays on Loki (see `lokiActorId`). */
  key: string;
  /**
   * Set when the key is not here at all: the person keeps it on Loki and
   * switched it on for their bots, and Loki makes the call for this actor
   * (services/loki/shared-keys.ts). There is no secret on this side.
   */
  lokiActorId?: string;
  /** For a key on Loki: the model the person chose for it there. */
  model?: string;
}

/** Where a key of this provider is called and with which model, or null when
 *  this app has no client for it. OpenRouter is not here: it keeps its own
 *  routed client and model choice (sendMessage-internals). */
export function directRuntime(provider: string): { baseUrl: string; model: string } | null {
  if (provider === 'groq') {
    return { baseUrl: PROVIDER_BASE_URLS.groq, model: PLATFORM_GROQ_MODEL };
  }
  const runtime = getProviderRuntime(provider);
  return runtime ? { baseUrl: runtime.baseUrl, model: runtime.defaultModel } : null;
}

/**
 * A provider this app has a name and a default model for, so a key of it
 * that stays on Loki can answer here. Asked by the Cat's chain and by its
 * model menu; it lives in this lookup-only file so the menu's page load can
 * ask it without being able to reach a model.
 */
export function isCallableThroughLoki(provider: string): boolean {
  return provider === 'groq' || provider === 'openrouter' || getProviderRuntime(provider) !== null;
}

/** Pure: the first of the person's keys, in their saved order, a bot can run on. */
export function pickOwnKey(keys: ReadonlyArray<OwnKey>): OwnKey | null {
  return (
    keys.find(
      k =>
        !!k.lokiActorId ||
        (!!k.key && (k.provider === 'openrouter' || directRuntime(k.provider) !== null))
    ) ?? null
  );
}

/**
 * What every bot turn needs to know about the person's own key, read once.
 * One reader for the one-to-one turn, the group chat and the routine, so the
 * three cannot disagree about whether a person has a key.
 */
export async function readOwnKey(
  keys: { listDecryptedKeysOrdered(userId: string): Promise<OwnKey[]> },
  userId: string,
  /** The person's switched-on keys on Loki; asked only when no key is saved here. */
  onLoki?: () => Promise<OwnKey[]>
): Promise<{ hasByok: boolean; userKey: string | null; directKey: OwnKey | null }> {
  const own =
    pickOwnKey(await keys.listDecryptedKeysOrdered(userId)) ??
    (onLoki ? pickOwnKey(await onLoki().catch(() => [])) : null);
  // A key on Loki is called through Loki whatever its provider, OpenRouter included.
  const routed = own?.provider === 'openrouter' && !own.lokiActorId;
  return {
    hasByok: !!own,
    userKey: own && routed ? own.key : null,
    directKey: own && !routed ? own : null,
  };
}
