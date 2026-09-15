/**
 * OpenAI-Compatible AI Service
 *
 * One client for every provider that speaks the OpenAI chat-completions
 * wire format (OpenAI, Together, DeepSeek, xAI, plus self-hosted Ollama /
 * LM Studio / vLLM once the local routing decision lands). Eight or nine
 * providers in one class — that's the whole point of the OpenAI-compatible
 * convention.
 *
 * Groq and OpenRouter keep their own service classes because they predate
 * this unification and carry provider-specific extras (rate-limit header
 * inspection on Groq; BTC cost-per-model on OpenRouter). New providers
 * should land here.
 *
 * Interface matches GroqService + OpenRouterService so the provider-
 * resolver can swap implementations without changing the chat route.
 *
 * Created: 2026-06-10
 */

import { sanitizeApiKey } from '@/lib/api-key';

export interface OpenAICompatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompatChatResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  finishReason: string;
  /** Always false here — provider-direct keys mean the user pays them. */
  isFreeModel: boolean;
  /** Always true here — this client only runs against user-provided keys. */
  usedByok: boolean;
}

export interface OpenAICompatStreamChunkResult {
  content: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface ChatRequest {
  model: string;
  messages: OpenAICompatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
}

interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: { role?: string; content?: string };
    finish_reason: string | null;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export class OpenAICompatibleAPIError extends Error {
  type: string;
  statusCode?: number;
  providerId: string;

  constructor(message: string, type: string, providerId: string, statusCode?: number) {
    super(message);
    this.name = 'OpenAICompatibleAPIError';
    this.type = type;
    this.statusCode = statusCode;
    this.providerId = providerId;
  }

  isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode === 502 || this.statusCode === 503;
  }
}

export class OpenAICompatibleService {
  private apiKey: string;
  private baseUrl: string;
  private providerId: string;
  private isByok: boolean;

  constructor(opts: {
    apiKey: string;
    baseUrl: string;
    providerId: string;
    /** Always true for now — this client only runs against BYOK. */
    isByok?: boolean;
  }) {
    this.apiKey = sanitizeApiKey(opts.apiKey);
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.providerId = opts.providerId;
    this.isByok = opts.isByok ?? true;
  }

  isUsingByok(): boolean {
    return this.isByok;
  }

  async chatCompletion(params: {
    model: string;
    messages: OpenAICompatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<OpenAICompatChatResult> {
    const { model, messages, temperature = 0.7, maxTokens } = params;

    const body: ChatRequest = {
      model,
      messages,
      temperature,
      stream: false,
    };
    if (maxTokens) {
      body.max_tokens = maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    const data = (await response.json()) as ChatResponse;
    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      finishReason: data.choices[0]?.finish_reason ?? 'stop',
      isFreeModel: false,
      usedByok: this.isByok,
    };
  }

  async *streamChatCompletion(params: {
    model: string;
    messages: OpenAICompatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<OpenAICompatStreamChunkResult> {
    const { model, messages, temperature = 0.7, maxTokens } = params;

    const body: ChatRequest = {
      model,
      messages,
      temperature,
      stream: true,
    };
    if (maxTokens) {
      body.max_tokens = maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new OpenAICompatibleAPIError('No response body', 'no_response', this.providerId);
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
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            yield { content: '', done: true, usage };
            return;
          }
          try {
            const parsed = JSON.parse(data) as StreamChunk;
            const content = parsed.choices?.[0]?.delta?.content ?? '';
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
            // Skip malformed JSON chunks — typical with heartbeat lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true, usage };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async toApiError(response: Response): Promise<OpenAICompatibleAPIError> {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = body.error?.message ?? `${this.providerId} error: HTTP ${response.status}`;
    const type =
      response.status === 401
        ? 'invalid_api_key'
        : response.status === 429
          ? 'rate_limit'
          : (body.error?.type ?? 'api_error');
    return new OpenAICompatibleAPIError(message, type, this.providerId, response.status);
  }
}

/**
 * Factory matching the createGroqServiceWithByok / createOpenRouterServiceWithByok
 * pattern. Only BYOK exists here — there are no platform env-var keys for these
 * providers (we deliberately don't want to be on the hook for their inference cost).
 */
export function createOpenAICompatibleServiceWithByok(opts: {
  apiKey: string;
  baseUrl: string;
  providerId: string;
}): OpenAICompatibleService {
  return new OpenAICompatibleService({ ...opts, isByok: true });
}
