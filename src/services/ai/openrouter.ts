/**
 * OpenRouter AI Service
 *
 * Unified gateway for all AI model interactions.
 * Handles streaming, error recovery, and cost tracking.
 *
 * Supports BYOK (Bring Your Own Key) - users can provide their own
 * OpenRouter API keys, or fall back to platform shared key.
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-08
 */

import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';

import {
  getModelMetadata,
  calculateCostBtc,
  isModelFree,
  DEFAULT_BTC_PRICE_USD,
} from '@/config/ai-models';
import { sanitizeApiKey } from '@/lib/api-key';

// ==================== TYPES ====================

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface OpenRouterResponse {
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
    cost?: number;
    cost_details?: {
      upstream_inference_cost?: number | null;
      upstream_inference_prompt_cost?: number;
      upstream_inference_completions_cost?: number;
    };
  };
  created: number;
}

interface OpenRouterStreamChunk {
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
    cost?: number;
    cost_details?: {
      upstream_inference_cost?: number | null;
      upstream_inference_prompt_cost?: number;
      upstream_inference_completions_cost?: number;
    };
  };
}

interface ChatCompletionResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costBtc: number;
  finishReason: string;
  /** Whether this used a free model (no API cost) */
  isFreeModel: boolean;
  /** Whether BYOK was used (vs platform key) */
  usedByok: boolean;
}

interface StreamChunk {
  content: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costBtc?: number;
  };
}

interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// ==================== SERVICE CLASS ====================

export class OpenRouterService {
  private apiKey: string;
  private baseUrl = PROVIDER_BASE_URLS.openrouter;
  private btcPriceUsd: number;
  private siteUrl: string;
  private siteName: string;
  private isByok: boolean;

  constructor(
    apiKey: string,
    options: {
      btcPriceUsd?: number;
      siteUrl?: string;
      siteName?: string;
      /** Whether this is a user-provided key (BYOK) */
      isByok?: boolean;
    } = {}
  ) {
    this.apiKey = apiKey;
    this.btcPriceUsd = options.btcPriceUsd || DEFAULT_BTC_PRICE_USD;
    this.siteUrl = options.siteUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://orangecat.ch';
    this.siteName = options.siteName || 'OrangeCat';
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
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  }): Promise<ChatCompletionResult> {
    const {
      model,
      messages,
      temperature = 0.7,
      maxTokens,
      systemPrompt,
      topP,
      frequencyPenalty,
      presencePenalty,
    } = params;

    // Validate model exists
    const modelMeta = getModelMetadata(model);
    if (!modelMeta) {
      throw new OpenRouterAPIError(`Unknown model: ${model}`, 'invalid_model');
    }

    // Prepend system prompt if provided
    const fullMessages: OpenRouterMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const request: OpenRouterRequest = {
      model,
      messages: fullMessages,
      // Some models (registry: supportsTemperature=false) 400 on a non-default
      // temperature — omit the param entirely for those.
      ...(modelMeta.supportsTemperature !== false && { temperature }),
      max_tokens: maxTokens || modelMeta.maxOutputTokens,
      stream: false,
    };

    // Add optional parameters if provided
    if (topP !== undefined) {
      request.top_p = topP;
    }
    if (frequencyPenalty !== undefined) {
      request.frequency_penalty = frequencyPenalty;
    }
    if (presencePenalty !== undefined) {
      request.presence_penalty = presencePenalty;
    }

    const response = await this.makeRequest<OpenRouterResponse>('/chat/completions', request);

    // Check if this is a free model
    const isFreeModel = isModelFree(model);

    // Prefer OpenRouter's returned request charge when present; otherwise fall
    // back to the registry estimate so older/partial responses still meter.
    const reportedCostBtc = toBtcFromOpenRouterUsage(response.usage, this.btcPriceUsd);
    const costBtc = isFreeModel
      ? 0
      : (reportedCostBtc ??
        calculateCostBtc(
          model,
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          this.btcPriceUsd
        ));

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      costBtc,
      finishReason: response.choices[0]?.finish_reason || 'stop',
      isFreeModel,
      usedByok: this.isByok,
    };
  }

  /**
   * Stream a chat completion (for real-time responses)
   */
  async *streamChatCompletion(params: {
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): AsyncGenerator<StreamChunk> {
    const { model, messages, temperature = 0.7, maxTokens, systemPrompt } = params;

    const modelMeta = getModelMetadata(model);
    if (!modelMeta) {
      throw new OpenRouterAPIError(`Unknown model: ${model}`, 'invalid_model');
    }

    const fullMessages: OpenRouterMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages: fullMessages,
        ...(modelMeta.supportsTemperature !== false && { temperature }),
        max_tokens: maxTokens || modelMeta.maxOutputTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new OpenRouterAPIError(
        (errorBody as OpenRouterError).error?.message || `API error: ${response.status}`,
        'api_error',
        response.status
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new OpenRouterAPIError('No response body', 'no_response');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let usage:
      | { inputTokens: number; outputTokens: number; totalTokens: number; costBtc?: number }
      | undefined;

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
              const parsed: OpenRouterStreamChunk = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';

              // Capture usage from final chunk
              if (parsed.usage) {
                usage = {
                  inputTokens: parsed.usage.prompt_tokens,
                  outputTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                  costBtc: toBtcFromOpenRouterUsage(parsed.usage, this.btcPriceUsd),
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

  /**
   * Check if a model is available
   */
  async checkModelAvailability(modelId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.data || [];
      return models.some((m: { id: string }) => m.id === modelId);
    } catch {
      return false;
    }
  }

  /**
   * Get current rate limits
   */
  async getRateLimits(): Promise<{
    requestsRemaining: number;
    requestsLimit: number;
    tokensRemaining: number;
    tokensLimit: number;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/key`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        requestsRemaining: data.data?.rate_limit?.requests_remaining || 0,
        requestsLimit: data.data?.rate_limit?.requests_limit || 0,
        tokensRemaining: data.data?.rate_limit?.tokens_remaining || 0,
        tokensLimit: data.data?.rate_limit?.tokens_limit || 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Update BTC price for cost calculations
   */
  setBtcPrice(priceUsd: number): void {
    this.btcPriceUsd = priceUsd;
  }

  /**
   * Get current BTC price
   */
  getBtcPrice(): number {
    return this.btcPriceUsd;
  }

  // ==================== PRIVATE METHODS ====================

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer': this.siteUrl,
      'X-Title': this.siteName,
    };
  }

  private async makeRequest<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = errorBody as OpenRouterError;

      // Handle specific error types
      if (response.status === 401) {
        throw new OpenRouterAPIError('Invalid API key', 'invalid_api_key', 401);
      }
      if (response.status === 429) {
        throw new OpenRouterAPIError('Rate limit exceeded', 'rate_limit', 429);
      }
      if (response.status === 402) {
        throw new OpenRouterAPIError('Insufficient credits', 'insufficient_credits', 402);
      }

      throw new OpenRouterAPIError(
        error.error?.message || `API error: ${response.status}`,
        error.error?.type || 'api_error',
        response.status
      );
    }

    return response.json();
  }
}

function toBtcFromOpenRouterUsage(
  usage:
    | {
        cost?: number;
        cost_details?: {
          upstream_inference_cost?: number | null;
          upstream_inference_prompt_cost?: number;
          upstream_inference_completions_cost?: number;
        };
      }
    | undefined,
  btcPriceUsd: number
): number | undefined {
  const reportedUsd = usage?.cost;
  if (!Number.isFinite(reportedUsd) || reportedUsd === undefined || reportedUsd <= 0) {
    return undefined;
  }
  return Math.ceil((reportedUsd / btcPriceUsd) * 1e8) / 1e8;
}

// ==================== ERROR CLASS ====================

class OpenRouterAPIError extends Error {
  type: string;
  statusCode?: number;

  constructor(message: string, type: string, statusCode?: number) {
    super(message);
    this.name = 'OpenRouterAPIError';
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
 * Create an OpenRouter service instance using platform API key
 * Used when user doesn't have BYOK
 */
export function createOpenRouterService(options?: { btcPriceUsd?: number }): OpenRouterService {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable not set');
  }
  return new OpenRouterService(sanitizeApiKey(apiKey), { ...options, isByok: false });
}

/**
 * Create service with user's own API key (BYOK)
 */
export function createOpenRouterServiceWithByok(
  userApiKey: string,
  options?: { btcPriceUsd?: number }
): OpenRouterService {
  return new OpenRouterService(sanitizeApiKey(userApiKey), { ...options, isByok: true });
}
