/**
 * AI Provider Registry — SSOT for which providers Cat surfaces in the UI.
 *
 * Honest data only: no ratings, no review counts, no "difficulty levels,"
 * no invented "setup time" numbers. Just what's factually true about each
 * provider — the kind of fields you can verify in 30 seconds by visiting
 * their site.
 *
 * `type` tells the UI which group to render the provider in:
 *   - 'direct'     → vendor-owned API (Anthropic, OpenAI, Google, Groq, ...)
 *   - 'aggregator' → single key fronts many upstream models (OpenRouter, Together)
 *   - 'local'      → runs on the user's own machine (Ollama, LM Studio)
 *   - 'media'      → generates video / music rather than text (Replicate).
 *                    A media key is NOT a chat key: it never appears in the
 *                    Cat's fallback chain, and Cat cannot answer with it.
 *
 * Runtime support is layered separately. Today the chat route only routes
 * Groq + OpenRouter natively; other providers get their keys stored and will
 * route once the generic OpenAI-compatible client lands in a follow-up.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-06-10 (strip fake metadata, add Ollama + LM Studio)
 */

export type AIProviderCategory = 'direct' | 'aggregator' | 'local' | 'media';

/**
 * Providers Cat's chat route can route through today (server-reachable).
 * SSOT for AIKeyAddForm filter and CAT_WIRED_PROVIDERS on /pricing.
 */
export const WIRED_PROVIDER_IDS = [
  'groq',
  'openrouter',
  'openai',
  'together',
  'deepseek',
  'xai',
] as const;

export type WiredProviderId = (typeof WIRED_PROVIDER_IDS)[number];

/**
 * Providers whose keys drive the STUDIO (video + music), not chat.
 *
 * Kept separate from WIRED_PROVIDER_IDS on purpose: that list means "the chat
 * route can answer with this", and a Replicate key cannot. Both lists are
 * storable, which is what KEYABLE_PROVIDER_IDS below is for.
 */
export const MEDIA_PROVIDER_IDS = ['replicate'] as const;

export type MediaProviderId = (typeof MEDIA_PROVIDER_IDS)[number];

/** Every provider a user may save a key for. SSOT for the api-keys route. */
export const KEYABLE_PROVIDER_IDS = [...WIRED_PROVIDER_IDS, ...MEDIA_PROVIDER_IDS] as const;

export interface AIProvider {
  id: string;
  name: string;
  type: AIProviderCategory;
  /** One-line factual description shown on the provider card. */
  description: string;
  /** Provider home page. */
  websiteUrl: string;
  /** Where to create / manage an API key. */
  apiKeyUrl: string;
  /** Provider API docs (linked from settings for power users). */
  docsUrl: string;
  /** Where to top up prepaid credits / manage billing (shown on quota errors). */
  billingUrl?: string;
  /** Optional prefix the key must start with — used for format validation. */
  apiKeyPrefix?: string;
  /** Placeholder shown in the key input. */
  apiKeyExample?: string;
}

export const aiProviders: AIProvider[] = [
  // ── Aggregators ────────────────────────────────────────────────────────
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'aggregator',
    description: 'One key, 200+ models (Claude, GPT, Gemini, Llama, and more). Free pool included.',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    billingUrl: 'https://openrouter.ai/credits',
    docsUrl: 'https://openrouter.ai/docs',
    apiKeyPrefix: 'sk-or-',
    apiKeyExample: 'sk-or-v1-xxxxxxxxxxxxxxxx',
  },
  {
    id: 'together',
    name: 'Together AI',
    type: 'aggregator',
    description: 'Open-source models at scale, including fine-tuning.',
    websiteUrl: 'https://together.ai',
    apiKeyUrl: 'https://api.together.ai/settings/api-keys',
    docsUrl: 'https://docs.together.ai',
    apiKeyExample: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  },

  // ── Direct providers ──────────────────────────────────────────────────
  {
    id: 'groq',
    name: 'Groq',
    type: 'direct',
    description: 'Fastest inference. Free tier covers most chat use.',
    websiteUrl: 'https://groq.com',
    apiKeyUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs',
    apiKeyPrefix: 'gsk_',
    apiKeyExample: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'direct',
    description: 'Claude models direct from the makers.',
    websiteUrl: 'https://anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
    apiKeyPrefix: 'sk-ant-',
    apiKeyExample: 'sk-ant-api03-xxxxxxxxxxxxxxxx',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'direct',
    description: 'GPT-4o and the OpenAI model family.',
    websiteUrl: 'https://openai.com',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    billingUrl: 'https://platform.openai.com/settings/organization/billing/overview',
    docsUrl: 'https://platform.openai.com/docs',
    apiKeyPrefix: 'sk-',
    apiKeyExample: 'sk-proj-xxxxxxxxxxxxxxxx',
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    type: 'direct',
    description: 'Gemini models with very long context windows.',
    websiteUrl: 'https://ai.google.dev',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/docs',
    apiKeyPrefix: 'AIza',
    apiKeyExample: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    type: 'direct',
    description: 'Grok models — real-time X knowledge, fewer content restrictions.',
    websiteUrl: 'https://x.ai',
    apiKeyUrl: 'https://console.x.ai/api-keys',
    billingUrl: 'https://console.x.ai',
    docsUrl: 'https://docs.x.ai',
    apiKeyPrefix: 'xai-',
    apiKeyExample: 'xai-xxxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'direct',
    description: 'Strong coding, long context, very low prices.',
    websiteUrl: 'https://deepseek.com',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://platform.deepseek.com/api-docs',
    apiKeyPrefix: 'sk-',
    apiKeyExample: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
  },

  // ── Media (video + music generation, not chat) ────────────────────────
  {
    id: 'replicate',
    name: 'Replicate',
    type: 'media',
    description: 'Video and music models (Veo, MusicGen, and more) behind one key.',
    websiteUrl: 'https://replicate.com',
    apiKeyUrl: 'https://replicate.com/account/api-tokens',
    billingUrl: 'https://replicate.com/account/billing',
    docsUrl: 'https://replicate.com/docs',
    apiKeyPrefix: 'r8_',
    apiKeyExample: 'r8_xxxxxxxxxxxxxxxxxxxxxxxx',
  },

  // ── Local ─────────────────────────────────────────────────────────────
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'local',
    description: 'Run models on your own machine. Nothing leaves the laptop.',
    websiteUrl: 'https://ollama.com',
    apiKeyUrl: 'https://ollama.com/download',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
    apiKeyExample: 'http://localhost:11434',
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    type: 'local',
    description: 'Desktop app for running open models locally with an OpenAI-compatible API.',
    websiteUrl: 'https://lmstudio.ai',
    apiKeyUrl: 'https://lmstudio.ai',
    docsUrl: 'https://lmstudio.ai/docs',
    apiKeyExample: 'http://localhost:1234/v1',
  },
];

const wiredIdSet = new Set<string>(WIRED_PROVIDER_IDS);

/** Subset of aiProviders that Cat routes through on the platform key path. */
export const wiredProviders = aiProviders.filter(p => wiredIdSet.has(p.id));

/** Display names for marketing copy — derived from the provider registry. */
export const WIRED_PROVIDER_DISPLAY_NAMES = wiredProviders.map(p => p.name);

const mediaIdSet = new Set<string>(MEDIA_PROVIDER_IDS);

/** Subset of aiProviders whose keys the Studio can render video / music with. */
export const mediaProviders = aiProviders.filter(p => mediaIdSet.has(p.id));

/** Everything a user may save a key for, in the order the key form shows them. */
export const keyableProviders = [...wiredProviders, ...mediaProviders];

// ==================== UTILITY FUNCTIONS ====================

/** Get provider by ID. */
export function getAIProvider(id: string): AIProvider | undefined {
  return aiProviders.find(p => p.id === id);
}

/** Group providers by type for the settings UI. */
export function getProvidersByCategory(type: AIProviderCategory): AIProvider[] {
  return aiProviders.filter(p => p.type === type);
}

/**
 * Default suggestion when the user hasn't picked anything yet. OpenRouter
 * because one key fronts all the major models — least friction for new
 * users, and the path most likely to "just work."
 */
export function getRecommendedProvider(): AIProvider {
  return aiProviders.find(p => p.id === 'openrouter') || aiProviders[0];
}

/**
 * Validate an API key against the provider's known prefix + a basic length
 * sanity check. Doesn't actually call the provider — that happens server-side
 * via the key-validation endpoint.
 */
export function validateApiKeyFormat(
  providerId: string,
  apiKey: string
): { valid: boolean; message?: string } {
  const provider = getAIProvider(providerId);
  if (!provider) {
    return { valid: false, message: 'Unknown provider' };
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, message: 'API key is required' };
  }

  // Local providers take a URL, not a key — skip the prefix check.
  if (provider.type === 'local') {
    try {
      new URL(apiKey);
      return { valid: true };
    } catch {
      return { valid: false, message: 'Expected a URL like http://localhost:11434' };
    }
  }

  if (provider.apiKeyPrefix && !apiKey.startsWith(provider.apiKeyPrefix)) {
    return {
      valid: false,
      message: `API key should start with "${provider.apiKeyPrefix}"`,
    };
  }

  if (apiKey.length < 20) {
    return { valid: false, message: 'API key seems too short' };
  }

  return { valid: true };
}
