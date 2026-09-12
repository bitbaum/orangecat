/**
 * May this user use this capability, on this model, right now?
 *
 * ADR-0008 D3. One question, asked in one place, answered from facts that
 * already exist — not a boolean someone has to remember to check.
 *
 * The shape this replaces is a global flag. The repo has four instances of it
 * (`FEATURES.voiceInput`, `CAT_CREDITS_LIVE`, `SECTION_SELECTION_ENABLED`,
 * `CatAction.enabled`) plus a fifth, sneakier one: presence of an env var
 * standing in for "this works". Each is on or off for EVERYBODY, so shipping a
 * capability to the users who have paid for it means editing code.
 *
 * A capability is a ROW here, with three independent terms:
 *
 *   1. can the MODEL do it        — the registry, or a live observation
 *   2. may this USER have it      — their access source (free / byok / credits)
 *   3. can we SERVE it at all     — is a backend actually configured
 *
 * and a fourth for things that are built but deliberately not on yet:
 *
 *   4. has someone GRANTED it     — an explicit per-user decision
 *
 * A denial says WHICH term failed. That matters more than it looks: a user
 * whose model cannot see images and a user who has not paid are both told
 * "no", and telling them apart is the difference between "bring a better
 * model" and "this costs money". Silence — today's behaviour — teaches neither.
 *
 * NOT a new tier vocabulary. `ModelAccessSource` already names the three ways a
 * user reaches a model and is already derived from real state (a verified BYOK
 * key, a credit balance). Adding a fourth notion of "tier" to the three this
 * repo already has would be the bug this file exists to stop.
 */
import { getModelMetadata, type ModelCapability } from '@/config/ai-models';
import { toolPlanForModel } from './tool-capability';
import type { ToolVerdict } from '@bitbaum/ai-kit/capability';
import type { ModelAccessSource } from './model-access';

/** The capabilities Cat can be asked for. */
export type CatCapability = 'tools' | 'web' | 'vision' | 'computer_use';

/** Which term of the rule refused. */
export type DenialReason = 'model' | 'entitlement' | 'grant' | 'unconfigured';

export type CapabilityVerdict =
  { allowed: true } | { allowed: false; because: DenialReason; detail: string };

const ALLOWED: CapabilityVerdict = { allowed: true };

export interface CapabilityContext {
  modelId: string | null | undefined;
  /** How this user reaches the model. Defaults to the most restrictive. */
  access?: ModelAccessSource;
  /** What live traffic has proven about this model's tool use, if anything. */
  observedTools?: ToolVerdict;
  /** Capabilities explicitly granted to this user. */
  grants?: readonly CatCapability[];
}

interface CapabilityRule {
  /**
   * Can the model do it? Returns a reason when not.
   *
   * For `tools` this DELEGATES to the observation system rather than reading
   * the registry, because the registry is a prior and a live refusal is
   * evidence. Duplicating that judgement here would be a second answer to a
   * question that already has one (ADR-0008 D1).
   */
  model?: (ctx: CapabilityContext) => string | null;
  /** Which access sources may use it. Absent means all of them. */
  access?: readonly ModelAccessSource[];
  /** Can the platform serve it at all — a backend, a key, a runtime. */
  configured?: () => boolean;
  /** Built, and off until someone says otherwise for a specific user. */
  needsGrant?: boolean;
}

/** Does the registry say this model has a capability? */
function modelDeclares(modelId: string | null | undefined, capability: ModelCapability): boolean {
  if (!modelId) {
    return false;
  }
  return getModelMetadata(modelId)?.capabilities?.includes(capability) ?? false;
}

/**
 * Is any web backend configured?
 *
 * Read at call time, not at module load: a module-level constant freezes the
 * answer into the bundle and cannot be fixed by restarting with a key set.
 */
function webIsConfigured(): boolean {
  return Boolean(
    process.env.SEARXNG_URL || process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY
  );
}

export const CAPABILITY_RULES: Record<CatCapability, CapabilityRule> = {
  // The tool loop. Asked of the model and of what traffic proved, never of a
  // provider name — see tool-capability.ts.
  tools: {
    model: ctx =>
      toolPlanForModel(ctx.modelId, ctx.observedTools ?? 'unobserved').sendTools
        ? null
        : 'this model has told us it cannot use tools',
  },

  // Search and page reading. Free for everyone on purpose: looking things up is
  // how Cat stops inventing figures, so rationing it would ration honesty.
  web: {
    configured: webIsConfigured,
  },

  // Reading an image the user attached.
  vision: {
    model: ctx => (modelDeclares(ctx.modelId, 'vision') ? null : 'this model cannot see images'),
  },

  // ADR-0008 D4. Built as a row so it can be switched on per user, and off
  // until then — the bound that matters is not cost, it is that a keyboard
  // turns "fetch a url I chose" into "type anything, anywhere". Needs a
  // model that can both see and call tools, and an explicit grant that
  // nothing currently issues.
  computer_use: {
    needsGrant: true,
    model: ctx =>
      modelDeclares(ctx.modelId, 'vision') && modelDeclares(ctx.modelId, 'function_calling')
        ? null
        : 'computer use needs a model that can both see and call tools',
    access: ['byok', 'credits'],
  },
};

/**
 * Rows that exist before anything asks the gate about them.
 *
 * A row nothing consults is a claim that the gate governs something it does
 * not — someone reading `CAPABILITY_RULES.vision` reasonably assumes vision is
 * gated, and today nothing checks it. That is the same shape as a flag
 * asserting an implementation exists, which this codebase shipped twice in one
 * day before making the claim a lookup instead.
 *
 * So an unconsumed row must SAY SO, with a reason, and a gate enforces both
 * directions: a new row needs either a caller or an entry here, and an entry
 * here that has since acquired a caller is stale and must go.
 *
 * Read it as the difference between "not gated yet" and "gated", stated where
 * a reader will see it rather than left to be inferred from call sites.
 */
export const AWAITING_CONSUMER: Partial<Record<CatCapability, string>> = {
  // The loop asks `toolPlanForModel` directly, which is the SSOT. This row
  // delegates to that same function so the two answers cannot diverge when a
  // caller does arrive — it is deliberately redundant, not unwired.
  tools: 'the tool loop asks toolPlanForModel directly; this row delegates to it',
  // Nothing sends an image to a model yet.
  vision: 'no caller sends images',
  // ADR-0008 D4: the gate term is built, the executor is not — it needs a
  // sandboxed browser and an enumerated origin list.
  computer_use: 'no executor; see ADR-0008 D4',
};

/**
 * Ask the one question.
 *
 * Terms are checked cheapest-first and the FIRST failure is reported, so the
 * answer names the thing the user could actually change.
 */
export function mayUseCapability(
  capability: CatCapability,
  ctx: CapabilityContext
): CapabilityVerdict {
  const rule = CAPABILITY_RULES[capability];

  if (rule.configured && !rule.configured()) {
    return {
      allowed: false,
      because: 'unconfigured',
      detail: `${capability} is not configured on this deployment`,
    };
  }

  if (rule.needsGrant && !ctx.grants?.includes(capability)) {
    return {
      allowed: false,
      because: 'grant',
      detail: `${capability} is off until it is granted for this account`,
    };
  }

  if (rule.access && !rule.access.includes(ctx.access ?? 'free')) {
    return {
      allowed: false,
      because: 'entitlement',
      detail: `${capability} needs your own key or credits`,
    };
  }

  const modelProblem = rule.model?.(ctx);
  if (modelProblem) {
    return { allowed: false, because: 'model', detail: modelProblem };
  }

  return ALLOWED;
}

/** Convenience for call sites that only branch on yes/no. */
export function canUseCapability(capability: CatCapability, ctx: CapabilityContext): boolean {
  return mayUseCapability(capability, ctx).allowed;
}

/** The tools that need a search backend — named once so nothing drifts. */
const WEB_TOOL_NAMES = new Set(['web_search', 'read_page']);

/**
 * The platform tools this turn may actually offer.
 *
 * Applies the rule the action tools already followed — do not offer what
 * cannot work, because a tool that must fail teaches the model to propose it.
 * The web tools were exempt: with no search backend configured they were still
 * offered every turn, and every lookup came back "could not look".
 */
export function offerablePlatformTools<T extends { function: { name: string } }>(
  tools: readonly T[],
  ctx: CapabilityContext
): T[] {
  if (canUseCapability('web', ctx)) {
    return [...tools];
  }
  return tools.filter(t => !WEB_TOOL_NAMES.has(t.function.name));
}
