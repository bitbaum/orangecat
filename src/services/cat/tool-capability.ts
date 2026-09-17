/**
 * Can THIS model drive the tool loop?
 *
 * Replaces `providerSupportsNativeTools(providerId)`, which asked about the
 * PROVIDER and answered from a list of two names. That list was wrong in both
 * directions at once: it denied tools to every user who brought their own
 * OpenAI, Together, DeepSeek or xAI key — models that all speak OpenAI-style
 * function calling, and whose owners are paying for exactly that — while
 * claiming nothing about the free models that answer tools only in prose.
 *
 * The rules live in `@bitbaum/ai-kit/capability`. What lives here is the one
 * OrangeCat-specific decision: how to read our own model registry as a PRIOR.
 *
 * ## The trap this file exists to avoid
 *
 * `config/ai-models.ts` flags `function_calling` per model. The tempting
 * implementation reads "no flag" as "no tools" — and that reproduces the whole
 * bug one layer down. The registry is incomplete by construction: it is a
 * hand-maintained list of models we happened to catalogue, and a user can
 * bring one nobody here has heard of. Reading its silence as a denial would
 * permanently refuse tools to every such model WITHOUT EVER ASKING, which is
 * precisely what the provider list did.
 *
 * So absence means `unobserved`, never `none`. A registry says where to start,
 * never where to stop. Only a real answer from a real model may produce a
 * negative, and that lives in the observation layer.
 */
import {
  planToolAttempt,
  classifyToolAttempt,
  currentVerdict,
  makeRecord,
  scopeKey,
  shouldReplace,
  type CapabilityRecord,
  type ToolAttempt,
  type ToolPlan,
  type ToolVerdict,
} from '@bitbaum/ai-kit/capability';
import { getModelMetadata } from '@/config/ai-models';

/**
 * What our registry CLAIMS about a model's tool support.
 *
 * Returns only `native` or `unobserved` — deliberately never `none`. See the
 * header: silence from an incomplete list is not a denial.
 */
export function declaredToolVerdict(modelId: string | null | undefined): ToolVerdict {
  if (!modelId) {
    return 'unobserved';
  }
  const meta = getModelMetadata(modelId);
  if (!meta) {
    // A model we have never catalogued. Almost certainly a BYOK user's own
    // choice, and almost certainly capable — but we do not know, so we ask.
    return 'unobserved';
  }
  return meta.capabilities.includes('function_calling') ? 'native' : 'unobserved';
}

/**
 * Decide what to send this model.
 *
 * `observed` is threaded through for when the observation store lands; until
 * then every model is `unobserved`, which means "ask" — and asking is how a
 * model that nobody catalogued gets its tools.
 */
export function toolPlanForModel(
  modelId: string | null | undefined,
  observed: ToolVerdict = 'unobserved'
): ToolPlan {
  return planToolAttempt({ observed, declared: declaredToolVerdict(modelId) });
}

/**
 * What the PROMPT may claim, which is a different question from what to send.
 *
 * `actionsVia: 'tools'` does not mean "this model probably supports tools". It
 * means "the prose action catalogue has been DROPPED because tool definitions
 * are being sent instead" (ADR-0006 D7). So it must track whether definitions
 * will actually go on the wire — not whether we are hopeful about the model.
 *
 * Getting this wrong is expensive in one specific direction. If the catalogue
 * is dropped and no definitions are sent, Cat is left with NO verb at all: it
 * cannot act through the tool loop, and the prompt no longer tells it how to
 * act in prose. A user on a local model or a provider we hold no key for would
 * lose the ability to do anything — which is the exact group the capability
 * work exists to serve.
 *
 * Hence the AND. Optimism belongs on the wire, where asking is how we learn;
 * the claim stays conservative, because an unearned claim costs a working
 * feature rather than a round-trip.
 */
export function actionsViaForModel(
  modelId: string | null | undefined,
  hasToolCredentials: boolean,
  observed: ToolVerdict = 'unobserved'
): 'tools' | 'prose' {
  return toolPlanForModel(modelId, observed).sendTools && hasToolCredentials ? 'tools' : 'prose';
}

// ── remembering what we learned ───────────────────────────────────────────
//
// Without this, the capability decision has no memory: every turn asks a model
// that has already refused, the prompt drops the prose catalogue because
// definitions are "being sent", and the definitions are rejected again. A
// tool-incapable model would be permanently verbless — unable to act through
// the loop and no longer told how to act in prose.
//
// One observation fixes that for every later turn: the model is recorded as
// `none`, so the loop stops sending and `actionsViaForModel` returns 'prose'.
//
// IN-PROCESS, and deliberately so for now. It resets on deploy and is not
// shared between instances, which costs at most one re-learning turn per model
// per process — a real cost, and far smaller than the schema this would
// otherwise need. The shape is `ai-kit`'s `CapabilityRecord`, so swapping this
// Map for a table is a change of storage, not of rules.
const observations = new Map<string, CapabilityRecord>();

/**
 * Bounded by construction. An unbounded Map keyed by model id is a slow leak
 * on a process that sees many BYOK model names; evicting the oldest entry
 * costs one extra learning turn and cannot grow without limit.
 */
const MAX_OBSERVATIONS = 500;

/** Key by model AND credential: capability genuinely differs per key. */
function observationKey(modelId: string, toolKey: string | null | undefined): string {
  return `${scopeKey(toolKey)}:${modelId}`;
}

/** What we have actually seen this model do, or `unobserved`. */
export function observedToolVerdict(
  modelId: string | null | undefined,
  toolKey: string | null | undefined
): ToolVerdict {
  if (!modelId) {
    return 'unobserved';
  }
  return currentVerdict(observations.get(observationKey(modelId, toolKey)));
}

/**
 * Read one real response for what it proves, and write it down if it proves
 * anything. Most failures prove nothing — see `classifyToolAttempt`, which
 * only records a negative when the vendor SAYS it is about tools.
 */
export function recordToolAttempt(
  modelId: string | null | undefined,
  toolKey: string | null | undefined,
  attempt: ToolAttempt
): void {
  if (!modelId) {
    return;
  }
  const seen = classifyToolAttempt(attempt);
  if (!seen.record) {
    return;
  }
  const k = observationKey(modelId, toolKey);
  const incoming = makeRecord({
    provider: '',
    model: modelId,
    scope: scopeKey(toolKey),
    capability: 'tools',
    verdict: seen.verdict,
    via: 'live',
    evidence: seen.evidence,
  });
  if (!shouldReplace(observations.get(k), incoming)) {
    return;
  }
  if (!observations.has(k) && observations.size >= MAX_OBSERVATIONS) {
    const oldest = observations.keys().next().value;
    if (oldest) {
      observations.delete(oldest);
    }
  }
  observations.set(k, incoming);
}

/** Test seam — production never clears what it learned. */
export function __resetObservationsForTest(): void {
  observations.clear();
}
