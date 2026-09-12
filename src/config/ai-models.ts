/**
 * AI Model Registry - Single Source of Truth
 *
 * Central registry for all AI models available through OpenRouter.
 * Follows the ENTITY_REGISTRY pattern for consistency.
 *
 * Includes FREE models (with :free suffix) that have no API cost.
 * Free models have rate limits: 50/day (free accounts) or 1000/day ($10+ balance)
 *
 * Created: 2026-01-07
 * Last Modified: 2026-07-08
 */

import { BADGE_COLORS } from '@/config/badge-colors';
// ==================== TYPES ====================

export const MODEL_TIERS = ['free', 'economy', 'standard', 'premium'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export type ModelCapability = 'text' | 'vision' | 'function_calling' | 'json_mode' | 'streaming';

export interface AIModelMetadata {
  /** OpenRouter model ID (e.g., 'anthropic/claude-3-opus') */
  id: string;
  /** Display name */
  name: string;
  /** Provider (e.g., 'Anthropic', 'OpenAI') */
  provider: string;
  /** Short description */
  description: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Max output tokens */
  maxOutputTokens: number;
  /** Input cost per 1M tokens in USD (0 for free models) */
  inputCostPer1M: number;
  /** Output cost per 1M tokens in USD (0 for free models) */
  outputCostPer1M: number;
  /** Model capabilities */
  capabilities: ModelCapability[];
  /** Performance tier for auto-routing */
  tier: ModelTier;
  /** Recommended for specific use cases */
  recommendedFor: string[];
  /** Whether model is available/enabled */
  isAvailable: boolean;
  /** Whether this is a free model (no API cost) */
  isFree?: boolean;
  /** Rate limit info for free models */
  rateLimit?: string;
  /**
   * Whether the model accepts a non-default `temperature`. Absent = true.
   * Current Anthropic frontier models (Sonnet 5, Opus 4.8, Opus 5, Fable 5)
   * reject non-default sampling params, so requests must omit the param.
   */
  supportsTemperature?: boolean;
}

// ==================== MODEL REGISTRY ====================

export const AI_MODEL_REGISTRY: Record<string, AIModelMetadata> = {
  // ==================== FREE TIER ====================
  // No API cost - rate limited (50/day on free accounts, 1000/day with $10+ credits)
  // Refreshed 2026-08-02 against the live OpenRouter catalog (/api/v1/models).
  // ⚠️ Free model ids ROT — OpenRouter retires them without notice and requests
  // 404. Every entry here is checked by the free-model catalog health probe
  // (services/cat/health-probes.ts); if the probe reports one missing, replace
  // it here and nowhere else — every consumer derives from this registry.

  'nvidia/nemotron-3-super-120b-a12b:free': {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B (Free)',
    provider: 'NVIDIA',
    description: 'Best free general model for reasoning, coding, and everyday chat',
    contextWindow: 262144,
    maxOutputTokens: 8192,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    capabilities: ['text', 'streaming'],
    tier: 'free',
    recommendedFor: ['complex reasoning', 'coding', 'general chat'],
    isAvailable: true,
    isFree: true,
    rateLimit: '50-1000/day',
  },

  'openai/gpt-oss-20b:free': {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B (Free)',
    provider: 'OpenAI',
    description: 'Fast free open-weight model with tool use and structured output support',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    capabilities: ['text', 'function_calling', 'json_mode', 'streaming'],
    tier: 'free',
    recommendedFor: ['fast responses', 'simple tasks', 'tool-friendly chat'],
    isAvailable: true,
    isFree: true,
    rateLimit: '50-1000/day',
  },

  'nvidia/nemotron-nano-9b-v2:free': {
    id: 'nvidia/nemotron-nano-9b-v2:free',
    name: 'Nemotron Nano 9B (Free)',
    provider: 'NVIDIA',
    description: 'Fast free model for quick answers and high-volume simple tasks',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    capabilities: ['text', 'streaming'],
    tier: 'free',
    recommendedFor: ['fast responses', 'simple tasks', 'high volume'],
    isAvailable: true,
    isFree: true,
    rateLimit: '50-1000/day',
  },

  'google/gemma-4-31b-it:free': {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B (Free)',
    provider: 'Google',
    description: 'Free multimodal long-context model for image-aware and document-heavy prompts',
    contextWindow: 262144,
    maxOutputTokens: 8192,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    capabilities: ['text', 'vision', 'streaming'],
    tier: 'free',
    recommendedFor: ['vision tasks', 'long context', 'multimodal chat'],
    isAvailable: true,
    isFree: true,
    rateLimit: '50-1000/day',
  },

  // ==================== ECONOMY TIER ====================
  // Fast & cheap for simple tasks

  'meta-llama/llama-3.1-8b-instruct': {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'Meta',
    description: 'Ultra-cheap chat model for short prompts and high-volume utility work',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.02,
    outputCostPer1M: 0.03,
    capabilities: ['text', 'streaming'],
    tier: 'economy',
    recommendedFor: ['simple questions', 'high volume', 'cheap chat'],
    isAvailable: true,
  },

  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'OpenAI',
    description: 'Low-cost open-weight agentic model with native tools and strong coding utility',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.03,
    outputCostPer1M: 0.15,
    capabilities: ['text', 'function_calling', 'json_mode', 'streaming'],
    tier: 'economy',
    recommendedFor: ['coding', 'agentic flows', 'cheap reasoning'],
    isAvailable: true,
  },

  'deepseek/deepseek-v4-flash': {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    description: 'Best-value 1M-context model for responsive coding and long-document work',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.09,
    outputCostPer1M: 0.18,
    capabilities: ['text', 'streaming'],
    tier: 'economy',
    recommendedFor: ['large documents', 'coding', 'cost-efficient analysis'],
    isAvailable: true,
  },

  // ==================== STANDARD TIER ====================
  // Balanced performance & cost

  'qwen/qwen3-32b': {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'Qwen',
    description: 'Strong mid-tier reasoning and tool-use model with unusually low cost',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    inputCostPer1M: 0.08,
    outputCostPer1M: 0.28,
    capabilities: ['text', 'function_calling', 'streaming'],
    tier: 'standard',
    recommendedFor: ['tool use', 'reasoning', 'multilingual work'],
    isAvailable: true,
  },

  'anthropic/claude-sonnet-5': {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'Anthropic',
    description: 'Best coding and professional-work balance in the current frontier',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCostPer1M: 2.0,
    outputCostPer1M: 10.0,
    capabilities: ['text', 'vision', 'function_calling', 'streaming'],
    tier: 'standard',
    recommendedFor: ['coding', 'agents', 'professional writing', 'research'],
    isAvailable: true,
    supportsTemperature: false,
  },

  // ==================== PREMIUM TIER ====================
  // Maximum capability for complex tasks

  'anthropic/claude-opus-4.8': {
    id: 'anthropic/claude-opus-4.8',
    name: 'Claude Opus 4.8',
    provider: 'Anthropic',
    description: 'Highest-quality generally available Anthropic model for hard autonomous work',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    capabilities: ['text', 'vision', 'function_calling', 'streaming'],
    tier: 'premium',
    recommendedFor: ['complex reasoning', 'research', 'high-stakes coding'],
    isAvailable: true,
    supportsTemperature: false,
  },

  'anthropic/claude-opus-5': {
    id: 'anthropic/claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'Anthropic',
    description: 'Newest Anthropic flagship for the hardest reasoning and agentic work',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCostPer1M: 5.0,
    outputCostPer1M: 25.0,
    capabilities: ['text', 'vision', 'function_calling', 'streaming'],
    tier: 'premium',
    recommendedFor: ['complex reasoning', 'agents', 'research', 'high-stakes coding'],
    isAvailable: true,
    supportsTemperature: false,
  },

  'anthropic/claude-fable-5': {
    id: 'anthropic/claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'Anthropic',
    description: 'Top-end long-horizon model for complex autonomous knowledge work',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCostPer1M: 10.0,
    outputCostPer1M: 50.0,
    capabilities: ['text', 'vision', 'function_calling', 'streaming'],
    tier: 'premium',
    recommendedFor: ['autonomous agents', 'long-running tasks', 'deep research'],
    isAvailable: true,
    supportsTemperature: false,
  },
};

// ==================== UTILITY FUNCTIONS ====================

const stripFreeSuffix = (id: string): string => id.replace(/:free$/, '');

// "a" is a prefix of "b" ending at a segment boundary ("-", ".", ":" or end).
const isBoundaryPrefix = (a: string, b: string): boolean =>
  b.startsWith(a) && (b.length === a.length || ['-', '.', ':'].includes(b[a.length]));

/**
 * Resolve a provider-reported model id back to a registered id.
 *
 * Providers can return snapshot/resolved ids that carry date/build suffixes
 * after the requested id. Billing and display must still hit the registry
 * instead of treating that known paid model as an unknown/free model.
 */
export function getRegisteredModelId(modelId: string): string | undefined {
  if (AI_MODEL_REGISTRY[modelId]) {
    return modelId;
  }

  const base = stripFreeSuffix(modelId);
  let match: AIModelMetadata | undefined;
  for (const model of Object.values(AI_MODEL_REGISTRY)) {
    const registryBase = stripFreeSuffix(model.id);
    if (isBoundaryPrefix(registryBase, base)) {
      if (!match || registryBase.length > stripFreeSuffix(match.id).length) {
        match = model;
      }
    }
  }
  return match?.id;
}

/**
 * Get metadata for a specific model, including provider-resolved snapshot ids.
 */
export function getModelMetadata(modelId: string): AIModelMetadata | undefined {
  const registeredId = getRegisteredModelId(modelId);
  return registeredId ? AI_MODEL_REGISTRY[registeredId] : undefined;
}

/**
 * Human-friendly display name for any model id — registered or not.
 *
 * Providers report *resolved* ids that can carry snapshot suffixes the
 * registry doesn't key on (e.g. `google/gemma-4-31b-it-20260402:free` for the
 * registered `google/gemma-4-31b-it:free`). Never surface a raw slug in UI:
 *   1. exact registry hit → its display name
 *   2. registry entry whose id is a boundary-safe prefix of the reported id
 *      (or vice versa) → its display name (longest match wins)
 *   3. otherwise derive a readable name from the slug itself
 */
export function getModelDisplayName(modelId: string): string {
  const exact = AI_MODEL_REGISTRY[modelId];
  if (exact) {
    return exact.name;
  }

  const registeredId = getRegisteredModelId(modelId);
  if (registeredId) {
    return AI_MODEL_REGISTRY[registeredId].name;
  }

  // Unknown model: prettify the slug ("mistralai/devstral-small-2505" → "Devstral Small 2505").
  const isFree = modelId.endsWith(':free');
  const slug = stripFreeSuffix(modelId).split('/').pop() ?? stripFreeSuffix(modelId);
  const pretty = slug
    .replace(/-\d{8}$/, '') // drop trailing date snapshot
    .split('-')
    .filter(Boolean)
    .map(word =>
      /^\d+(\.\d+)?[bm]$/i.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
  return isFree ? `${pretty} (Free)` : pretty;
}

/**
 * Get all models for a specific tier
 */
export function getModelsByTier(tier: ModelTier): AIModelMetadata[] {
  return Object.values(AI_MODEL_REGISTRY).filter(m => m.tier === tier && m.isAvailable);
}

/**
 * Get all available models
 */
export function getAvailableModels(): AIModelMetadata[] {
  return Object.values(AI_MODEL_REGISTRY).filter(m => m.isAvailable);
}

/**
 * Calculate inference cost in BTC (the canonical unit) for a model + token usage.
 *
 * Rounds UP to 1e-8 (the ledger/DB precision) so tiny completions never bill
 * as zero. Historical bug fixed 2026-07-02: this returned SATOSHIS despite the
 * name, which would have drifted every BTC-denominated column it fed
 * (ai_messages.api_cost_btc / cost_btc) by 1e8.
 *
 * @param modelId - The model ID
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param btcPriceUsd - Current BTC price in USD (default: 100000)
 * @returns Cost in BTC
 */
export function calculateCostBtc(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  btcPriceUsd: number = 100000
): number {
  const model = getModelMetadata(modelId);
  if (!model) {
    return 0;
  }

  const inputCostUsd = (inputTokens / 1_000_000) * model.inputCostPer1M;
  const outputCostUsd = (outputTokens / 1_000_000) * model.outputCostPer1M;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  return Math.ceil((totalCostUsd / btcPriceUsd) * 1e8) / 1e8;
}

// ==================== CONSTANTS ====================

/** Default model for Auto mode fallback (free model) */
export const DEFAULT_MODEL_ID = 'nvidia/nemotron-3-super-120b-a12b:free';

/** Default free model for platform usage */
export const DEFAULT_FREE_MODEL_ID = 'nvidia/nemotron-3-super-120b-a12b:free';

/** Default BTC price for cost calculations (updated periodically) */
export const DEFAULT_BTC_PRICE_USD = 100000;

/** Tier display configuration */
export const TIER_CONFIG: Record<
  ModelTier,
  { label: string; description: string; badgeClass: string; badge?: string }
> = {
  free: {
    label: 'Free',
    description: 'No API cost - rate limited',
    badgeClass: BADGE_COLORS.success,
    badge: 'FREE',
  },
  economy: {
    label: 'Economy',
    description: 'Fast & affordable for simple tasks',
    badgeClass: BADGE_COLORS.info,
  },
  standard: {
    label: 'Standard',
    description: 'Balanced performance & cost',
    badgeClass: BADGE_COLORS.tiffany,
  },
  premium: {
    label: 'Premium',
    description: 'Maximum capability for complex tasks',
    badgeClass: BADGE_COLORS.orange,
  },
};

/**
 * Get all free models
 */
export function getFreeModels(): AIModelMetadata[] {
  return Object.values(AI_MODEL_REGISTRY).filter(m => m.isFree === true && m.isAvailable);
}

/**
 * Check if a model is free
 */
export function isModelFree(modelId: string): boolean {
  const model = getModelMetadata(modelId);
  return model?.isFree === true;
}
