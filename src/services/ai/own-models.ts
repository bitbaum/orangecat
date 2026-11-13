/**
 * The models a person can choose for a bot, on their own key.
 *
 * Grok Bot has a model picker; a Cat Bot's turn used one fixed model per
 * provider and nobody could change it. The list is the provider's own answer
 * for that key (every provider this app calls directly serves the
 * OpenAI-style `GET /models`), not a table kept here: a table of other
 * companies' model names is wrong the week it is written, and a wrong name
 * is a turn that fails.
 *
 * Reading the list calls no model and spends nothing. On the shared pool
 * there is nothing to choose: the chain picks, and the answer says so.
 */
import { getAvailableModels } from '@/config/ai-models';
import { directRuntime, type OwnKey } from './own-key';

export interface ModelChoice {
  id: string;
  name: string;
}

export type ModelChoices =
  /** No key of their own: the shared pool picks. */
  | { source: 'pool' }
  /** Their own key; `fallback` is what a turn uses when nothing is chosen. */
  | {
      source: 'own';
      provider: string;
      fallback: string;
      models: ModelChoice[];
      /** The key is not here: the person keeps it on Loki. */
      heldOn?: 'loki';
    };

/** A model id as providers write them: no spaces, nothing that is not a name. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
/** Models that are not for a conversation. */
const NOT_CHAT =
  /embed|whisper|tts|audio|speech|transcri|image|dall-e|moderation|rerank|guard|realtime|sora|veo|imagine/i;
const LIST_TIMEOUT_MS = 8_000;
const MAX_MODELS = 80;

export function isModelId(id: unknown): id is string {
  return typeof id === 'string' && MODEL_ID.test(id);
}

/** The chat models in a provider's `GET /models` answer, by name. Pure. */
export function chatModelsFrom(body: unknown): ModelChoice[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const seen = new Set<string>();
  const out: ModelChoice[] = [];
  for (const item of data) {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const id = rec.id;
    if (!isModelId(id) || NOT_CHAT.test(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const shown = typeof rec.display_name === 'string' && rec.display_name.trim();
    out.push({ id, name: shown || id });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id)).slice(0, MAX_MODELS);
}

/**
 * The model a turn runs on: the one chosen, when it is a model id, else the
 * provider's default. "auto" and nothing both mean the default.
 */
export function chosenModel(requested: string | undefined, fallback: string): string {
  return requested && requested !== 'auto' && isModelId(requested) ? requested : fallback;
}

export async function listOwnModels(
  own: OwnKey | null,
  fetchImpl: typeof fetch = fetch,
  /** For a key that stays on Loki: Loki reads the provider's list. */
  onLoki?: (
    actorId: string,
    provider: string
  ) => Promise<{ chosen: string | null; models: string[] }>
): Promise<ModelChoices> {
  if (!own) {
    return { source: 'pool' };
  }
  if (own.lokiActorId) {
    const listed = onLoki
      ? await onLoki(own.lokiActorId, own.provider).catch(() => ({ chosen: null, models: [] }))
      : { chosen: null, models: [] };
    const fallback = listed.chosen ?? own.model ?? '';
    let models = chatModelsFrom({ data: listed.models.map(id => ({ id })) });
    if (fallback && !models.some(m => m.id === fallback)) {
      models = [{ id: fallback, name: fallback }, ...models];
    }
    return { source: 'own', provider: own.provider, fallback, models, heldOn: 'loki' };
  }
  if (own.provider === 'openrouter') {
    const models = getAvailableModels().map(m => ({ id: m.id, name: m.name }));
    return { source: 'own', provider: 'openrouter', fallback: 'auto', models };
  }
  const runtime = directRuntime(own.provider);
  if (!runtime) {
    return { source: 'pool' };
  }
  let models: ModelChoice[] = [];
  try {
    const res = await fetchImpl(`${runtime.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${own.key}`,
        // Anthropic's list takes its own two headers; the others ignore them.
        ...(own.provider === 'anthropic'
          ? { 'x-api-key': own.key, 'anthropic-version': '2023-06-01' }
          : {}),
      },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
    if (res.ok) {
      models = chatModelsFrom(await res.json().catch(() => null));
    }
  } catch {
    // The provider did not answer: the default still works, so say only that.
  }
  if (!models.some(m => m.id === runtime.model)) {
    models = [{ id: runtime.model, name: runtime.model }, ...models];
  }
  return { source: 'own', provider: own.provider, fallback: runtime.model, models };
}
