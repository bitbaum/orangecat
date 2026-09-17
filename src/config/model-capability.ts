/**
 * Model Capability Tiers — SSOT for "how much can the Cat do on this model?"
 *
 * OrangeCat is LLM-agnostic: the user (or the platform) chooses the model. That
 * choice should be an *informed* trade-off, never a silent degradation — so we
 * classify every model into an agentic-capability tier and surface honest copy
 * about what to expect. A frontier model gets the full experience (grounding,
 * multi-step tasks, discovery/matchmaking); a weaker one still works for chat,
 * and the UI says so.
 *
 * This is distinct from `ModelTier` (free/economy/standard/premium) in
 * ai-models.ts, which is about price/routing — capability is about *ability*.
 */

export type CapabilityTier = 'conversational' | 'capable' | 'frontier';

export interface ModelCapabilities {
  tier: CapabilityTier;
  /** Short label for badges, e.g. "Capable". */
  label: string;
  /** One honest sentence on what to expect — shown in tooltips / settings. */
  blurb: string;
  /**
   * Can this model reliably drive multi-step / tool-using work (agentic
   * retrieval, discovery, matchmaking)? Only frontier models qualify today.
   */
  agentic: boolean;
}

const TIERS: Record<CapabilityTier, Omit<ModelCapabilities, never>> = {
  conversational: {
    tier: 'conversational',
    label: 'Conversational',
    blurb:
      'Best for simple questions and short answers. May struggle with multi-step reasoning, careful grounding, or tool use.',
    agentic: false,
  },
  capable: {
    tier: 'capable',
    label: 'Capable',
    blurb:
      'Solid for chat, drafting, and suggestions. Discovery, matchmaking, and multi-step tasks work best on a frontier model.',
    agentic: false,
  },
  frontier: {
    tier: 'frontier',
    label: 'Frontier',
    blurb:
      'Full power — reliable grounding, multi-step reasoning, tool use, and discovery/matchmaking.',
    agentic: true,
  },
};

// Frontier: top reasoning/agentic models (Claude/GPT-4-class, Grok, Gemini Pro,
// reasoning models, 200B+ / 405B). These can drive tools and discovery.
const FRONTIER = [
  /claude.*(3\.5|3\.7|sonnet|opus|haiku-4|[- ]?4)/, // claude 3.5/3.7/4, sonnet, opus
  /gpt-4o|gpt-4\.1|gpt-4-turbo|chatgpt-4o/,
  /\bo[134]\b|o1-|o3-|o4-/, // OpenAI reasoning (o1/o3/o4)
  /grok/,
  /gemini.*(1\.5|2\.0|2\.5).*pro|gemini-pro-1\.5/,
  /deepseek.*(r1|reasoner|v3)/,
  /llama.*(405b|3\.1-405)/,
  /qwen.*(max|235b)/,
  /mistral-large/,
  /command-r-plus/,
];

// Capable: strong general models (~27B–120B, frontier-flash variants). Great for
// chat and drafting, not reliably agentic yet.
const CAPABLE = [
  /70b|72b|120b|gpt-oss-120b|nemotron.*(super|120b|ultra)/,
  /gemma.*(27b|26b|31b)/,
  /mixtral|mistral-small-3|mistral-medium/,
  /gemini.*flash/,
  /qwen.*(32b|3-next)/,
  /deepseek-chat/,
  /command-r\b/,
];

const norm = (id: string) => id.toLowerCase();

/** Classify a model id into an agentic-capability tier (with honest copy). */
export function getModelCapabilities(modelId: string | null | undefined): ModelCapabilities {
  if (!modelId) {
    return TIERS.capable; // unknown → assume mid, neither over- nor under-promise
  }
  const id = norm(modelId);
  if (FRONTIER.some(re => re.test(id))) {
    return TIERS.frontier;
  }
  if (CAPABLE.some(re => re.test(id))) {
    return TIERS.capable;
  }
  return TIERS.conversational;
}

/** Whether the model can reliably drive agentic features (discovery, tools). */
export function isAgenticModel(modelId: string | null | undefined): boolean {
  return getModelCapabilities(modelId).agentic;
}
