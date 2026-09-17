/**
 * AI Auto Router
 *
 * Intelligently selects the optimal model based on:
 * - Task complexity
 * - Cost optimization
 * - Model availability
 * - Creator preferences
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 */

import {
  AI_MODEL_REGISTRY,
  ModelTier,
  AIModelMetadata,
  getModelsByTier,
  getAvailableModels,
  DEFAULT_MODEL_ID,
  DEFAULT_BTC_PRICE_USD,
} from '@/config/ai-models';
import {
  analyzeComplexity as analyzeMessageComplexity,
  type ComplexityAnalysis,
} from '@/services/ai/message-complexity';

// ==================== TYPES ====================

interface RoutingParams {
  /** The user's message */
  message: string;
  /** Previous messages in the conversation */
  conversationHistory?: Array<{ role: string; content: string }>;
  /** List of allowed model IDs (empty = all) */
  allowedModels?: string[];
  /** Preferred tier (overrides complexity analysis) */
  preferredTier?: ModelTier;
  /** Maximum cost per request in BTC */
  maxCostBtc?: number;
  /** Whether the task requires vision */
  requiresVision?: boolean;
  /** Whether the task requires function calling */
  requiresFunctionCalling?: boolean;
}

interface RoutingResult {
  /** Selected model ID */
  model: string;
  /** Human-readable reason for selection */
  reason: string;
  /** Model tier */
  tier: ModelTier;
  /** Estimated cost in BTC */
  estimatedCostBtc: number;
  /** Complexity score (0-1) */
  complexityScore: number;
}

/** `recommendedFor` tags that mark a model as meant for hard work. */
const REASONING_TAGS = ['complex reasoning', 'reasoning', 'research', 'coding', 'agents'];
/** `recommendedFor` tags that mark a model as meant for cheap, easy volume. */
const LIGHTWEIGHT_TAGS = ['simple', 'high volume', 'fast responses'];

/**
 * How suited a model is to a hard turn, derived from the registry's own
 * `recommendedFor`. Higher is better. This exists so the free pool — where
 * every candidate costs exactly 0 — is ordered by what the models are FOR
 * rather than by the order someone typed them into the registry.
 */
export function qualityRank(model: AIModelMetadata): number {
  const tags = model.recommendedFor.map(t => t.toLowerCase());
  const has = (list: string[]) => list.filter(t => tags.some(tag => tag.includes(t))).length;
  return has(REASONING_TAGS) * 2 - has(LIGHTWEIGHT_TAGS);
}

// ==================== AUTO ROUTER CLASS ====================

class AIAutoRouter {
  private btcPriceUsd: number;

  constructor(btcPriceUsd: number = DEFAULT_BTC_PRICE_USD) {
    this.btcPriceUsd = btcPriceUsd;
  }

  /**
   * Select optimal model for the given request
   */
  selectModel(params: RoutingParams): RoutingResult {
    const {
      message,
      conversationHistory = [],
      allowedModels,
      preferredTier,
      maxCostBtc,
      requiresVision,
      requiresFunctionCalling,
    } = params;

    // Analyze message complexity
    const complexity = this.analyzeComplexity(message, conversationHistory);

    // Determine target tier based on complexity or preference
    let targetTier: ModelTier;
    if (preferredTier) {
      targetTier = preferredTier;
    } else if (complexity.score < 0.3) {
      targetTier = 'economy';
    } else if (complexity.score < 0.7) {
      targetTier = 'standard';
    } else {
      targetTier = 'premium';
    }

    // Get candidate models
    let candidates = this.getCandidates(targetTier, {
      allowedModels,
      requiresVision,
      requiresFunctionCalling,
    });

    // If no candidates in target tier, try other tiers
    if (candidates.length === 0) {
      candidates = this.getFallbackCandidates({
        allowedModels,
        requiresVision,
        requiresFunctionCalling,
      });
    }

    // Filter by max cost if specified
    if (maxCostBtc !== undefined && maxCostBtc > 0) {
      candidates = candidates.filter(m => {
        const estimatedCost = this.estimateCost(m, complexity.estimatedTokens);
        return estimatedCost <= maxCostBtc;
      });
    }

    // Fallback if no candidates
    if (candidates.length === 0) {
      const fallback = AI_MODEL_REGISTRY[DEFAULT_MODEL_ID];
      return {
        model: fallback.id,
        reason: 'Fallback to default model (no matching candidates)',
        tier: fallback.tier,
        estimatedCostBtc: this.estimateCost(fallback, complexity.estimatedTokens),
        complexityScore: complexity.score,
      };
    }

    // Cost first, then QUALITY — not cost alone. Every free model costs 0, so
    // a pure cost sort left the winner to be whichever the registry happened
    // to list first, and the registry lists a model recommended for 'simple
    // tasks' above one recommended for 'complex reasoning'. That is how a
    // strategy question got the 20B. `recommendedFor` already encodes the
    // answer; the router simply never read it.
    candidates.sort(
      (a, b) => a.inputCostPer1M - b.inputCostPer1M || qualityRank(b) - qualityRank(a)
    );
    const selected = candidates[0];

    return {
      model: selected.id,
      reason: this.buildReason(complexity, selected),
      tier: selected.tier,
      estimatedCostBtc: this.estimateCost(selected, complexity.estimatedTokens),
      complexityScore: complexity.score,
    };
  }

  /**
   * Analyze message complexity using heuristics
   */

  /** Kept on the class so existing callers keep working; the logic moved out. */
  analyzeComplexity(
    message: string,
    history: Array<{ role: string; content: string }>
  ): ComplexityAnalysis {
    return analyzeMessageComplexity(message, history);
  }

  /**
   * Update BTC price
   */
  setBtcPrice(priceUsd: number): void {
    this.btcPriceUsd = priceUsd;
  }

  // ==================== PRIVATE METHODS ====================

  private getCandidates(
    tier: ModelTier,
    filters: {
      allowedModels?: string[];
      requiresVision?: boolean;
      requiresFunctionCalling?: boolean;
    }
  ): AIModelMetadata[] {
    let candidates = getModelsByTier(tier);

    // Filter by allowed models
    if (filters.allowedModels && filters.allowedModels.length > 0) {
      candidates = candidates.filter(m => filters.allowedModels!.includes(m.id));
    }

    // Filter by capabilities
    if (filters.requiresVision) {
      candidates = candidates.filter(m => m.capabilities.includes('vision'));
    }
    if (filters.requiresFunctionCalling) {
      candidates = candidates.filter(m => m.capabilities.includes('function_calling'));
    }

    return candidates;
  }

  private getFallbackCandidates(filters: {
    allowedModels?: string[];
    requiresVision?: boolean;
    requiresFunctionCalling?: boolean;
  }): AIModelMetadata[] {
    let candidates = getAvailableModels();

    if (filters.allowedModels && filters.allowedModels.length > 0) {
      candidates = candidates.filter(m => filters.allowedModels!.includes(m.id));
    }

    if (filters.requiresVision) {
      candidates = candidates.filter(m => m.capabilities.includes('vision'));
    }
    if (filters.requiresFunctionCalling) {
      candidates = candidates.filter(m => m.capabilities.includes('function_calling'));
    }

    return candidates;
  }

  private estimateCost(model: AIModelMetadata, estimatedTokens: number): number {
    const inputTokens = Math.ceil(estimatedTokens * 0.4);
    const outputTokens = Math.ceil(estimatedTokens * 0.6);

    const inputCostUsd = (inputTokens / 1_000_000) * model.inputCostPer1M;
    const outputCostUsd = (outputTokens / 1_000_000) * model.outputCostPer1M;
    const totalCostUsd = inputCostUsd + outputCostUsd;

    const satsPerUsd = 100_000_000 / this.btcPriceUsd;
    return Math.ceil(totalCostUsd * satsPerUsd);
  }

  private buildReason(complexity: ComplexityAnalysis, model: AIModelMetadata): string {
    const parts: string[] = [];

    // Complexity description
    if (complexity.score < 0.3) {
      parts.push('Simple task');
    } else if (complexity.score < 0.7) {
      parts.push('Moderate complexity');
    } else {
      parts.push('Complex task');
    }

    // Task type
    if (complexity.taskType !== 'conversation') {
      parts.push(complexity.taskType.replace('_', ' '));
    }

    // Model selection reason
    parts.push(`→ ${model.name} (${model.tier})`);

    return parts.join(' ');
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * Create an Auto Router instance
 */
export function createAutoRouter(btcPriceUsd?: number): AIAutoRouter {
  return new AIAutoRouter(btcPriceUsd);
}
