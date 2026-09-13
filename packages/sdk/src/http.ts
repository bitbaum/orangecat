/**
 * Internal HTTP transport for @orangecat/sdk.
 *
 * - Bearer + `X-OrangeCat-Key` auth headers (either or both accepted server-side)
 * - Default timeout 20s — matches Loki's useFetch convention
 * - Idempotency-Key auto-generated when not supplied (planned server support;
 *   the SDK ships the header today so retries are forward-compatible the moment
 *   it lands)
 * - Exponential backoff retry on transient failures (network, 5xx, 429,
 *   honouring Retry-After) — bounded by maxRetries
 * - Unwraps the standard envelope: returns response.data on success, throws
 *   OrangeCatError with stable code on failure
 *
 * Best practices encoded:
 * - User-Agent identifies the SDK so server logs can attribute traffic
 * - AbortController on every request (defensive — Node's fetch otherwise
 *   leaks on slow servers)
 * - Never logs the key; the prefix is enough for telemetry
 */

import { OrangeCatError, codeForStatus, type OrangeCatErrorCode } from './errors.js';

export interface ClientOptions {
  /** Integration key minted at /settings/integrations. Format: `ock_<48-hex>`. */
  apiKey: string;
  /** Base URL. Default: https://orangecat.ch */
  baseUrl?: string;
  /** Default per-request timeout in ms. Default: 20_000 (matches Loki). */
  timeoutMs?: number;
  /** Max retries for transient failures. Default: 3 (4 attempts total). */
  maxRetries?: number;
  /**
   * Override fetch — useful in tests, edge runtimes, or environments without
   * global fetch (Node <18, which we don't support but consumers might patch).
   */
  fetch?: typeof globalThis.fetch;
  /** Override the User-Agent string. Default identifies the SDK + version. */
  userAgent?: string;
}

export interface RequestOptions {
  /** Per-call timeout override. */
  timeoutMs?: number;
  /** Per-call retry override. */
  maxRetries?: number;
  /**
   * Override the Idempotency-Key. When not set, the SDK generates one — same
   * input + same key + same endpoint within 24h dedupes server-side (planned).
   */
  idempotencyKey?: string;
  /** External AbortSignal — composes with the SDK's internal timeout. */
  signal?: AbortSignal;
}

interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  metadata?: Record<string, unknown>;
}

interface ApiErrorEnvelope {
  success: false;
  /**
   * Server returns `error` as a nested object — see
   * src/lib/api/standardResponse.ts ApiErrorResponse. Code arrives
   * UPPERCASE (e.g. "UNAUTHORIZED") — SDK normalizes to the lowercase
   * OrangeCatErrorCode enum.
   */
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function normalizeServerCode(raw?: string): OrangeCatErrorCode | undefined {
  if (!raw) {
    return undefined;
  }
  const lower = raw.toLowerCase();
  const known: OrangeCatErrorCode[] = [
    'unauthorized',
    'forbidden',
    'validation_error',
    'not_found',
    'conflict',
    'rate_limited',
    'internal_error',
    'network_error',
    'timeout',
    'unknown',
  ];
  return known.includes(lower as OrangeCatErrorCode) ? (lower as OrangeCatErrorCode) : undefined;
}

const PKG_NAME = '@orangecat/sdk';
const PKG_VERSION = '0.2.0';
const DEFAULT_BASE = 'https://orangecat.ch';
const DEFAULT_TIMEOUT = 20_000;
const DEFAULT_MAX_RETRIES = 3;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function defaultUserAgent(): string {
  const runtime =
    typeof process !== 'undefined' && process.versions?.node
      ? `node/${process.versions.node}`
      : 'web';
  return `${PKG_NAME}/${PKG_VERSION} (${runtime})`;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new OrangeCatError({ code: 'timeout', message: 'Aborted while sleeping' }));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function backoffMs(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec) {
    return Math.min(retryAfterSec * 1000, 60_000);
  }
  // Exponential with jitter: ~500ms, ~1s, ~2s, ~4s, capped at 30s.
  const base = Math.min(500 * 2 ** attempt, 30_000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly defaultMaxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly userAgent: string;

  constructor(options: ClientOptions) {
    if (!options.apiKey || !options.apiKey.startsWith('ock_')) {
      throw new Error(
        '@orangecat/sdk: apiKey is required and must start with "ock_". Mint one at /settings/integrations.'
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.defaultTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT;
    this.defaultMaxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.userAgent = options.userAgent ?? defaultUserAgent();

    if (typeof this.fetchImpl !== 'function') {
      throw new Error(
        '@orangecat/sdk: global fetch is not available. Use Node ≥18 or pass a fetch implementation in ClientOptions.'
      );
    }
  }

  async post<TResponse>(
    path: string,
    body: unknown,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', path, body, options);
  }

  async get<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>('GET', path, undefined, options);
  }

  private async request<TResponse>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions
  ): Promise<TResponse> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeout;
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const idempotencyKey =
      options.idempotencyKey ?? (method !== 'GET' ? `ock_idem_${randomHex(16)}` : undefined);

    const baseHeaders: Record<string, string> = {
      'X-OrangeCat-Key': this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    };
    if (body !== undefined) {
      baseHeaders['Content-Type'] = 'application/json';
    }
    if (idempotencyKey) {
      baseHeaders['Idempotency-Key'] = idempotencyKey;
    }

    let lastError: OrangeCatError | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.attempt<TResponse>(
          method,
          url,
          body,
          baseHeaders,
          timeoutMs,
          options.signal
        );
      } catch (err) {
        lastError = err instanceof OrangeCatError ? err : this.wrapUnknownError(err);
        if (attempt >= maxRetries || !lastError.isRetryable) {
          throw lastError;
        }
        await delay(backoffMs(attempt, lastError.retryAfter), options.signal);
      }
    }
    // Unreachable — the loop either returns or throws.
    throw lastError ?? new OrangeCatError({ code: 'unknown', message: 'Unknown error' });
  }

  private async attempt<TResponse>(
    method: string,
    url: string,
    body: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
    externalSignal?: AbortSignal
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new OrangeCatError({
          code: 'timeout',
          message: `Request to ${url} timed out after ${timeoutMs}ms`,
          cause: err,
        });
      }
      throw new OrangeCatError({
        code: 'network_error',
        message: `Network error calling ${url}`,
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

    let parsed: unknown = undefined;
    try {
      parsed = await response.json();
    } catch (err) {
      throw new OrangeCatError({
        code: 'internal_error',
        message: `Response from ${url} was not valid JSON (status ${response.status})`,
        status: response.status,
        cause: err,
      });
    }

    if (!response.ok) {
      const envelope = parsed as Partial<ApiErrorEnvelope> | null;
      const errorObj = envelope?.error;
      const code = normalizeServerCode(errorObj?.code) ?? codeForStatus(response.status);
      throw new OrangeCatError({
        code,
        message: errorObj?.message || `HTTP ${response.status}`,
        status: response.status,
        details: errorObj?.details,
        retryAfter,
      });
    }

    const envelope = parsed as ApiSuccessEnvelope<TResponse> | null;
    if (!envelope || envelope.success !== true) {
      throw new OrangeCatError({
        code: 'internal_error',
        message: `Unexpected response shape from ${url}`,
        status: response.status,
        details: envelope,
      });
    }
    return envelope.data;
  }

  private wrapUnknownError(err: unknown): OrangeCatError {
    return new OrangeCatError({
      code: 'unknown',
      message: err instanceof Error ? err.message : 'Unknown error',
      cause: err,
    });
  }
}
