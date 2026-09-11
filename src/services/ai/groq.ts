/**
 * Groq AI Service
 *
 * Fast inference with Groq's OpenAI-compatible API.
 * Free tier available - no credits required!
 *
 * Supports BYOK (Bring Your Own Key) - users can provide their own
 * Groq API keys, or fall back to platform shared key.
 *
 * Created: 2026-01-22
 */

import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import {
  estimateMessagesTokens,
  getGroqTpmLimit,
  recordGroqRateLimitHeaders,
  recordGroqTooLarge,
} from '@/services/ai/groq-capacity';

// ==================== TYPES ====================

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
}

interface GroqResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created: number;
}

interface GroqStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GroqChatResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  finishReason: string;
  /** Groq free tier - no cost */
  isFreeModel: boolean;
  /** Whether BYOK was used (vs platform key) */
  usedByok: boolean;
}

interface GroqStreamChunkResult {
  content: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface GroqError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// ==================== CONSTANTS ====================

// Groq's best free models.
//
// Both previous entries were gone: Groq withdrew the whole llama-3.x family, so
// this registry listed two models and served zero, and DEFAULT_GROQ_MODEL below
// pointed at one of them. platform-llm.ts was repaired for exactly this on
// 2026-08-26 — its comment records eight features "degrading gracefully" into
// doing nothing. This file is the same outage, in the half nobody looked at.
//
// Figures are Groq's own, from GET /models on 2026-08-27. The old entries
// claimed 128000/32768 and 128000/8192 for ids that no longer existed.
const GROQ_MODELS = {
  // The platform baseline: capable, tools + JSON.
  'openai/gpt-oss-120b': { name: 'GPT OSS 120B', contextWindow: 131072, maxOutputTokens: 65536 },
  // Same context, smaller and faster — more headroom under Groq's daily cap.
  'openai/gpt-oss-20b': { name: 'GPT OSS 20B', contextWindow: 131072, maxOutputTokens: 65536 },
} as const;

/**
 * Configured Groq model ids, for the catalog-drift probe.
 *
 * Groq decommissions models without notice, exactly as OpenRouter retires free
 * ones. `mixtral-8x7b-32768` and `gemma2-9b-it` sat here long after Groq had
 * removed them (both answered 400 "has been decommissioned" when measured on
 * 2026-08-06) — selecting either was a guaranteed failure. OpenRouter got a
 * standing probe after its third rot incident; Groq had none, which is why this
 * drift went unnoticed. See probeGroqModelCatalog in services/cat/health-probes.
 */
export const CONFIGURED_GROQ_MODEL_IDS = Object.keys(GROQ_MODELS);

/**
 * Default Groq model — the platform baseline a free (non-BYOK) user gets.
 *
 * This was `llama-3.3-70b-versatile`, itself an upgrade from
 * `llama-3.1-8b-instant`. Groq retired both, so the default and its documented
 * alternative died on the same day — but the reasoning survives the ids: pick
 * the most capable free model, since we cannot buy a better one (no fiat rails
 * to pay providers), and accept that a larger model exhausts the daily cap
 * sooner because the chain rolls to OpenRouter when it does. gpt-oss-120b is
 * the capable end of what Groq serves free; gpt-oss-20b is the headroom option.
 *
 * GROQ_MAX_OUTPUT_TOKENS stays at 2048 to fit Groq's per-minute TPM bucket
 * (reserved max_tokens counts against it), whatever the model would allow.
 *
 * To dial back to the smaller model without a deploy, set GROQ_DEFAULT_MODEL.
 */
export const DEFAULT_GROQ_MODEL: keyof typeof GROQ_MODELS =
  (process.env.GROQ_DEFAULT_MODEL as keyof typeof GROQ_MODELS | undefined) ?? 'openai/gpt-oss-120b';

/**
 * Default max output tokens for chat completions.
 *
 * Groq's free tier limits tokens-PER-MINUTE (e.g. 6000 TPM for
 * llama-3.1-8b-instant), and the *reserved* `max_tokens` counts against that
 * bucket up-front — so defaulting to the model's full 8192 output capability
 * makes every request exceed TPM and 429 (which silently fell the Cat back to
 * OpenRouter on every message). Callers that need more pass `maxTokens`
 * explicitly.
 *
 * Lowered 2048 -> 1024 on 2026-08-06. The reservation is pure prompt budget
 * spent up-front: at ~4.5 chars/token, 1024 fewer reserved output tokens buys
 * ~4,600 more characters of prompt, roughly halving the gap between Cat's
 * prompt and the on-demand ceiling. 1024 tokens is still a long chat reply
 * (~4,500 characters), and every caller that genuinely needs more — the
 * writing engine and reviser — already passes `maxTokens` explicitly, so this
 * narrows nothing but the default.
 */
export const GROQ_CHAT_MAX_TOKENS = 1024;

/**
 * Groq's on-demand service tier (the platform org's tier) hard-rejects any
 * single request whose tokens exceed its per-minute limit with HTTP 413 —
 * measured against the platform key 2026-08-02: "Limit 12000". Once a Cat
 * prompt outgrows this (memories + history + page excerpt), EVERY message
 * pays a guaranteed-failing Groq round-trip before falling back.
 *
 * 12000 is also the best on this key: measured 2026-08-06, llama-3.1-8b-instant
 * is 6000 and openai/gpt-oss-{20b,120b} are 8000. There is no higher-TPM model
 * to escape to — the prompt has to shrink.
 *
 * It is a ROLLING per-minute budget, not a per-request ceiling: back-to-back
 * requests in the same minute share it, so a second call can 413 on a payload
 * the first one accepted. Measure fit with a single call in a drained window.
 */
export const GROQ_ON_DEMAND_TPM_LIMIT = 12_000;

/**
 * Pre-flight fit check for the on-demand tier. The chars/4 estimate slightly
 * over-counts, so borderline prompts skip a little early instead of 413ing —
 * callers only invoke this when another chain link can serve the request.
 *
 * The real ratio for Cat's own prompt is ~4.5 chars/token, measured twice
 * against the live API on 2026-08-06 (60,747 chars → 13,827 prompt tokens;
 * 54,444 → 12,119). An earlier comment here claimed ~6, which made the prompt
 * look 52% over budget when it is ~39% over — the diet target was wrong by a
 * third. Do not restate this ratio from memory; measure it.
 * The reserved output budget counts against the same TPM bucket, so it's
 * part of the estimate.
 */
export function promptFitsGroqOnDemand(
  messages: Array<{ content: string | null | undefined }>,
  model: string = DEFAULT_GROQ_MODEL,
  maxTokens: number = GROQ_CHAT_MAX_TOKENS
): boolean {
  // The cap is per model and learned live (a 413 body names it); the estimate
  // errs high on purpose — under-estimating is how the 413 got through.
  return estimateMessagesTokens(messages) + maxTokens <= getGroqTpmLimit(model);
}

// ==================== SERVICE CLASS ====================

export class GroqService {
  private apiKey: string;
  private baseUrl = PROVIDER_BASE_URLS.groq;
  private isByok: boolean;

  constructor(
    apiKey: string,
    options: {
      /** Whether this is a user-provided key (BYOK) */
      isByok?: boolean;
    } = {}
  ) {
    this.apiKey = apiKey;
    this.isByok = options.isByok || false;
  }

  /**
   * Check if this service is using BYOK
   */
  isUsingByok(): boolean {
    return this.isByok;
  }

  /**
   * Send a non-streaming chat completion request
   */
  async chatCompletion(params: {
    model?: string;
    messages: GroqMessage[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    topP?: number;
  }): Promise<GroqChatResult> {
    const {
      model = DEFAULT_GROQ_MODEL,
      messages,
      temperature = 0.7,
      maxTokens,
      systemPrompt,
      topP,
    } = params;

    // Validate model exists
    const modelConfig = GROQ_MODELS[model as keyof typeof GROQ_MODELS];
    const maxOutput = modelConfig?.maxOutputTokens || 8192;

    // Prepend system prompt if provided
    const fullMessages: GroqMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const request: GroqRequest = {
      model,
      messages: fullMessages,
      temperature,
      max_tokens: maxTokens || Math.min(maxOutput, GROQ_CHAT_MAX_TOKENS),
      stream: false,
    };

    // Add optional parameters if provided
    if (topP !== undefined) {
      request.top_p = topP;
    }

    const response = await this.makeRequest<GroqResponse>('/chat/completions', request);

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      finishReason: response.choices[0]?.finish_reason || 'stop',
      isFreeModel: true, // Groq has generous free tier
      usedByok: this.isByok,
    };
  }

  /**
   * Stream a chat completion (for real-time responses)
   */
  async *streamChatCompletion(params: {
    model?: string;
    messages: GroqMessage[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): AsyncGenerator<GroqStreamChunkResult> {
    const {
      model = DEFAULT_GROQ_MODEL,
      messages,
      temperature = 0.7,
      maxTokens,
      systemPrompt,
    } = params;

    const modelConfig = GROQ_MODELS[model as keyof typeof GROQ_MODELS];
    const maxOutput = modelConfig?.maxOutputTokens || 8192;

    const fullMessages: GroqMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages: fullMessages,
        temperature,
        max_tokens: maxTokens || Math.min(maxOutput, GROQ_CHAT_MAX_TOKENS),
        stream: true,
      }),
    });

    // Groq reports its remaining requests-per-day and tokens-per-minute on
    // every response; nothing read them until 2026-09-11, so "free capacity is
    // maxed out" could never say how much was left or when it returns. Only
    // the PLATFORM key's numbers are recorded — a user's own key is their
    // business and its headroom is not the pool's.
    if (!this.isByok) {
      recordGroqRateLimitHeaders(model, response.headers);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = (errorBody as GroqError).error?.message || `API error: ${response.status}`;
      // A 413 body names the real per-minute cap ("Limit 8000, Requested
      // 8391"). Learning it beats the pinned constant that was measured once
      // in August and was 4 000 tokens too generous for the models Groq
      // actually serves this key.
      if (response.status === 413 && !this.isByok) {
        recordGroqTooLarge(model, message);
      }
      throw new GroqAPIError(
        message,
        response.status === 413 ? 'request_too_large' : 'api_error',
        response.status
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new GroqAPIError('No response body', 'no_response');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              yield { content: '', done: true, usage };
              return;
            }

            try {
              const parsed: GroqStreamChunk = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';

              // Capture usage from final chunk
              if (parsed.usage) {
                usage = {
                  inputTokens: parsed.usage.prompt_tokens,
                  outputTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                };
              }

              if (content) {
                yield { content, done: false };
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final yield with usage if available
    yield { content: '', done: true, usage };
  }

  // ==================== PRIVATE METHODS ====================

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async makeRequest<T>(endpoint: string, body: unknown): Promise<T> {
    const model =
      typeof (body as { model?: unknown })?.model === 'string'
        ? (body as { model: string }).model
        : DEFAULT_GROQ_MODEL;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!this.isByok) {
      recordGroqRateLimitHeaders(model, response.headers);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = errorBody as GroqError;

      // Handle specific error types
      if (response.status === 401) {
        throw new GroqAPIError('Invalid API key', 'invalid_api_key', 401);
      }
      if (response.status === 429) {
        throw new GroqAPIError('Rate limit exceeded', 'rate_limit', 429);
      }
      // Size, not speed: the request is bigger than one minute's budget. It
      // is never fixed by waiting, so it must not read as a rate limit.
      if (response.status === 413) {
        const message = error.error?.message || 'Request too large';
        if (!this.isByok) recordGroqTooLarge(model, message);
        throw new GroqAPIError(message, 'request_too_large', 413);
      }

      throw new GroqAPIError(
        error.error?.message || `API error: ${response.status}`,
        error.error?.type || 'api_error',
        response.status
      );
    }

    return response.json();
  }
}

// ==================== ERROR CLASS ====================

export class GroqAPIError extends Error {
  type: string;
  statusCode?: number;

  constructor(message: string, type: string, statusCode?: number) {
    super(message);
    this.name = 'GroqAPIError';
    this.type = type;
    this.statusCode = statusCode;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode === 503 || this.statusCode === 502;
  }
}

// ==================== FACTORY FUNCTIONS ====================

/**
 * Strip stray whitespace / newlines / control chars from an API key before
 * it goes into an Authorization header. Env vars set via secret-set commands
 * sometimes carry a trailing newline (or worse, a paste-artifact character)
 * that the Fetch API rejects with "invalid header value". Trim defensively at
 * every entry point.
 */
function sanitizeApiKey(key: string): string {
  return key.replace(/[\s\x00-\x1f\x7f]+/g, '');
}

/**
 * Create a Groq service instance using platform API key
 * Used when user doesn't have BYOK
 */
export function createGroqService(): GroqService {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable not set');
  }
  return new GroqService(sanitizeApiKey(apiKey), { isByok: false });
}

/**
 * Create service with user's own API key (BYOK)
 */
export function createGroqServiceWithByok(userApiKey: string): GroqService {
  return new GroqService(sanitizeApiKey(userApiKey), { isByok: true });
}

/**
 * Check if Groq is available (platform key configured)
 */
export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}
