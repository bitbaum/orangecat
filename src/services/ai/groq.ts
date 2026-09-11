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
import { recordGroqRateLimitHeaders, recordGroqTooLarge } from '@/services/ai/groq-capacity';
// Re-exported so every existing importer of '@/services/ai/groq' keeps working:
// the split is about file size, not about moving the public surface.
export {
  CONFIGURED_GROQ_MODEL_IDS,
  DEFAULT_GROQ_MODEL,
  GROQ_CHAT_MAX_TOKENS,
  GROQ_ON_DEMAND_TPM_LIMIT,
  getGroqModel,
  promptFitsGroqOnDemand,
} from '@/services/ai/groq-models';
import { DEFAULT_GROQ_MODEL, GROQ_CHAT_MAX_TOKENS, getGroqModel } from '@/services/ai/groq-models';

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
    const maxOutput = getGroqModel(model)?.maxOutputTokens || 8192;

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

    const maxOutput = getGroqModel(model)?.maxOutputTokens || 8192;

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
