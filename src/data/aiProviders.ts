/**
 * AI Provider Registry — SSOT for which providers Cat surfaces in the UI.
 *
 * Honest data only: no ratings, no review counts, no "difficulty levels,"
 * no invented "setup time" numbers. Just what's factually true about each
 * provider — the kind of fields you can verify in 30 seconds by visiting
 * their site.
 *
 * `type` tells the UI which group to render the provider in:
 *   - 'direct'      → vendor-owned API (Anthropic, OpenAI, Google, Groq, ...)
 *   - 'aggregator'  → single key fronts many upstream models (OpenRouter, Together)
 *   - 'local'       → runs on the user's own machine, reached from the browser
 *   - 'self-hosted' → any OpenAI-compatible server the user names by URL,
 *                     reached from OUR server (vLLM, llama.cpp, a remote
 *                     Ollama, LiteLLM, a model they trained themselves)
 *
 * Runtime support is layered separately: every id in WIRED_PROVIDER_IDS is
 * one the chat route can route through today.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-09-14 (the user's own endpoint is a provider)
 */

export type AIProviderCategory = 'direct' | 'aggregator' | 'local' | 'self-hosted';

/**
 * The one provider with no fixed host: the user supplies the base URL (and
 * the model) when they add the key. This is what makes "any model" literally
 * true — the platform can name six vendors, but it cannot name a server you
 * run, so the row has to.
 */
export const CUSTOM_PROVIDER_ID = 'custom';

/**
 * Vendors with a fixed base URL in PROVIDER_BASE_URLS (src/config/ai-provider-runtime).
 * SSOT for the per-vendor auth-check endpoints and the names on /pricing.
 */
export const WIRED_VENDOR_IDS = [
  'groq',
  'openrouter',
  'openai',
  'together',
  'deepseek',
  'xai',
] as const;

/**
 * Providers Cat's chat route can route through today (server-reachable):
 * the fixed vendors plus the user's own endpoint. SSOT for the API key
 * schema, the AIKeyAddForm filter, and the resolver's provider union.
 */
export const WIRED_PROVIDER_IDS = [...WIRED_VENDOR_IDS, CUSTOM_PROVIDER_ID] as const;

export type WiredProviderId = (typeof WIRED_PROVIDER_IDS)[number];

/**
 * What the settings form sends to POST /api/user/api-keys. `baseUrl` and
 * `defaultModel` are only meaningful for CUSTOM_PROVIDER_ID; the server
 * refuses a custom entry without a URL and ignores both for vendors.
 */
export interface AddKeyInput {
  provider: string;
  apiKey: string;
  keyName: string;
  baseUrl?: string;
  defaultModel?: string;
}

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

  // ── Self-hosted (reached from our server) ─────────────────────────────
  {
    id: CUSTOM_PROVIDER_ID,
    name: 'Your own endpoint',
    type: 'self-hosted',
    description:
      'Any OpenAI-compatible server you run — vLLM, llama.cpp, Ollama, LiteLLM, or a model you trained yourself. No vendor in the loop.',
    websiteUrl: 'https://orangecat.ch/docs',
    apiKeyUrl: 'https://orangecat.ch/docs',
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    apiKeyExample: 'leave empty if your server needs no key',
  },
];

const wiredIdSet = new Set<string>(WIRED_PROVIDER_IDS);
const wiredVendorIdSet = new Set<string>(WIRED_VENDOR_IDS);

/** Subset of aiProviders that Cat routes through on the platform key path. */
export const wiredProviders = aiProviders.filter(p => wiredIdSet.has(p.id));

/**
 * Wired vendors only — for surfaces that collect just a key (the onboarding
 * wizard has no URL field) and for the vendor names in marketing copy.
 */
export const wiredVendorProviders = aiProviders.filter(p => wiredVendorIdSet.has(p.id));

/** Vendor display names for marketing copy — derived from the provider registry. */
export const WIRED_PROVIDER_DISPLAY_NAMES = wiredVendorProviders.map(p => p.name);

export function isCustomProvider(providerId: string): boolean {
  return providerId === CUSTOM_PROVIDER_ID;
}

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

  // A self-hosted server may need no key at all (vLLM and llama.cpp ship
  // without auth). Empty is a valid answer here; the URL is checked server-side.
  if (provider.type === 'self-hosted') {
    return { valid: true };
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
