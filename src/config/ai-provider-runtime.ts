/**
 * Per-provider runtime configuration for OpenAI-compatible providers.
 *
 * The data layer (`src/data/aiProviders.ts`) is the SSOT for what's shown
 * to users — name, description, key URL, key prefix. This file is the SSOT
 * for what the chat route does with their key — base URL to call, default
 * model to use when the user hasn't picked one explicitly.
 *
 * Anything in this map can be reached by the generic
 * `OpenAICompatibleService` (one class, eight providers). Groq and
 * OpenRouter stay in their own service classes for historical reasons
 * (they predate this unification and have provider-specific niceties —
 * Groq tracks rate-limit headers, OpenRouter tracks BTC cost per model).
 *
 * Created: 2026-06-10
 */

export interface ProviderRuntimeConfig {
  /** Base URL for the OpenAI-compatible chat endpoint (without /chat/completions). */
  baseUrl: string;
  /** Model used when the user hasn't selected one. */
  defaultModel: string;
}

/**
 * SSOT for every provider's API base URL — including Groq and OpenRouter,
 * whose bespoke service classes are not in PROVIDER_RUNTIME. Nothing outside
 * src/config should spell out a provider host.
 */
export const PROVIDER_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  together: 'https://api.together.xyz/v1',
  deepseek: 'https://api.deepseek.com/v1',
  xai: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
} as const;

export const PROVIDER_RUNTIME: Record<string, ProviderRuntimeConfig> = {
  openai: {
    baseUrl: PROVIDER_BASE_URLS.openai,
    defaultModel: 'gpt-4o-mini',
  },
  together: {
    baseUrl: PROVIDER_BASE_URLS.together,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
  },
  deepseek: {
    baseUrl: PROVIDER_BASE_URLS.deepseek,
    defaultModel: 'deepseek-chat',
  },
  xai: {
    baseUrl: PROVIDER_BASE_URLS.xai,
    defaultModel: 'grok-2-latest',
  },
};

/** Provider IDs the OpenAICompatibleService can serve. */
export const OPENAI_COMPAT_PROVIDER_IDS = Object.keys(PROVIDER_RUNTIME) as Array<
  keyof typeof PROVIDER_RUNTIME
>;

export function getProviderRuntime(providerId: string): ProviderRuntimeConfig | null {
  return PROVIDER_RUNTIME[providerId] ?? null;
}

export function isOpenAICompatibleProvider(providerId: string): boolean {
  return providerId in PROVIDER_RUNTIME;
}

/**
 * Providers whose `/chat/completions` we drive with OpenAI-style native tool
 * calling (`tools` + `tool_choice`, replies carrying `tool_calls`).
 *
 * These are the two that actually serve OrangeCat: Groq (BYOK, paid TPM) and
 * OpenRouter (the platform path plus many BYOK models). Everything else —
 * including every local model — gets no tool definitions, so Cat can only
 * describe what it would do there.
 *
 * SSOT on purpose. This single fact decides two things that MUST agree, and
 * used to be spelled out independently in each: whether tool definitions are
 * sent (services/cat/tool-use.ts) and whether the system prompt claims Cat can
 * act (services/cat/system-prompt.ts). When they disagreed, the prompt won the
 * argument and the user was told an action had run when nothing could run it.
 */
export const TOOL_CAPABLE_PROVIDERS = ['groq', 'openrouter'] as const;

export function providerSupportsNativeTools(providerId: string): boolean {
  return (TOOL_CAPABLE_PROVIDERS as readonly string[]).includes(providerId);
}

// ---------------------------------------------------------------------------
// Image generation (BYOK-only)
// ---------------------------------------------------------------------------

export interface ImageProviderRuntimeConfig {
  /** Model used for image generation when the user hasn't picked one. */
  defaultImageModel: string;
  /**
   * How the provider exposes image output: the OpenAI-style
   * POST {baseUrl}/images/generations, or a /chat/completions call with
   * `modalities: ['image','text']` (OpenRouter's shape).
   */
  api: 'images' | 'chat';
  /** Only needed when the provider isn't in PROVIDER_RUNTIME (OpenRouter). */
  baseUrl?: string;
}

/**
 * Providers whose keys can also generate images. Base URL comes from
 * PROVIDER_RUNTIME above unless overridden — same provider, same key.
 *
 * BYOK-only by design: the platform free pool is text-only and must never
 * pay for image generation.
 */
export const IMAGE_PROVIDER_RUNTIME: Record<string, ImageProviderRuntimeConfig> = {
  openai: { defaultImageModel: 'gpt-image-1', api: 'images' },
  xai: { defaultImageModel: 'grok-2-image', api: 'images' },
  openrouter: {
    defaultImageModel: 'google/gemini-3.1-flash-image',
    api: 'chat',
    baseUrl: PROVIDER_BASE_URLS.openrouter,
  },
};

export function getImageProviderRuntime(
  providerId: string
): (ImageProviderRuntimeConfig & { baseUrl: string }) | null {
  const image = IMAGE_PROVIDER_RUNTIME[providerId];
  if (!image) {
    return null;
  }
  const baseUrl = image.baseUrl ?? PROVIDER_RUNTIME[providerId]?.baseUrl;
  return baseUrl ? { ...image, baseUrl } : null;
}
