/**
 * Embeddings service — turns text into a meaning-vector for semantic search.
 *
 * Provider-swappable via env (OpenAI-compatible /embeddings endpoint):
 *   EMBEDDINGS_API_KEY   (or OPENAI_API_KEY)   — required to enable semantic search
 *   EMBEDDINGS_BASE_URL  default https://api.openai.com/v1
 *   EMBEDDINGS_MODEL     default text-embedding-3-small (1536-dim)
 *
 * Switching to a free/self-hosted provider later (Jina, a local model, Ollama)
 * is just changing these env vars — no code change. If no key is set,
 * `embeddingsEnabled()` is false and callers fall back to keyword search, so the
 * platform degrades gracefully (and honestly, per the capability tiers).
 *
 * NOTE: the DB vector column is vector(1536). If you switch to a model with a
 * different dimension, a new migration must recreate the column + index.
 */

import { logger } from '@/utils/logger';

const EMBEDDINGS_DIM = 1536;
const MAX_INPUT_CHARS = 8000; // ~2k tokens; plenty for a bio/entity description

function apiKey(): string | undefined {
  return process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY || undefined;
}

function baseUrl(): string {
  return (process.env.EMBEDDINGS_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function model(): string {
  return process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small';
}

/** True when an embedding provider is configured (semantic search available). */
export function embeddingsEnabled(): boolean {
  return !!apiKey();
}

export { EMBEDDINGS_DIM };

/**
 * Embed one or more strings. Returns one vector per input (null for any that
 * failed/empty). Returns all-null and logs once if no provider is configured or
 * the request fails — callers should fall back to keyword search.
 */
export async function embedTexts(inputs: string[]): Promise<(number[] | null)[]> {
  const key = apiKey();
  if (!key) {
    return inputs.map(() => null);
  }
  const cleaned = inputs.map(t => (t || '').trim().slice(0, MAX_INPUT_CHARS));
  // OpenAI rejects empty strings; send a single space placeholder, map back to null.
  const payloadInput = cleaned.map(t => (t.length > 0 ? t : ' '));

  try {
    const res = await fetch(`${baseUrl()}/embeddings`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model(), input: payloadInput }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(
        'Embeddings request failed',
        { status: res.status, body: body.slice(0, 200) },
        'Embeddings'
      );
      return inputs.map(() => null);
    }
    const data = (await res.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const out: (number[] | null)[] = inputs.map(() => null);
    for (const row of data.data ?? []) {
      // null out the placeholder rows whose source was empty
      if (
        row &&
        Number.isInteger(row.index) &&
        row.index >= 0 &&
        row.index < cleaned.length &&
        cleaned[row.index].length > 0 &&
        Array.isArray(row.embedding) &&
        row.embedding.length === EMBEDDINGS_DIM &&
        row.embedding.every(Number.isFinite)
      ) {
        out[row.index] = row.embedding;
      }
    }
    return out;
  } catch (err) {
    logger.warn('Embeddings request threw', { err }, 'Embeddings');
    return inputs.map(() => null);
  }
}

/** Embed a single string (convenience). Null on failure / no provider. */
export async function embedText(input: string): Promise<number[] | null> {
  const [vec] = await embedTexts([input]);
  return vec;
}
